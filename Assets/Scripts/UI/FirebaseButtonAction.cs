using System;
using System.Threading.Tasks;
using Firebase.Firestore;
using TMPro;
using UnityEngine;
using UnityEngine.UI;


///----------------------------------------------------------------------------------------------
/// WHAT THIS SCRIPT DOES (in plain English):
///
/// This is a single, reusable script you can put on ANY button that needs to
/// do something in Firebase - completing a lesson, completing a quiz,
/// unlocking an achievement, unlocking a shop item, or adding XP/points.
///
/// Instead of writing a brand new script every time you add a new button,
/// you drop THIS script on the button, pick which action it should do from
/// a dropdown in the Inspector, fill in the relevant ID fields for that
/// action, and wire the button's OnClick() to call Execute().
///
/// When you need a new kind of Firebase action later (e.g. "claim daily
/// reward"), you add one new entry to the enum below and one new case in
/// the switch statement in Execute() - you do NOT need a new script or a
/// new button-wiring pattern.
///
/// COMPLETE LESSON / COMPLETE QUIZ SAFETY:
/// Firestore is always asked "is this already marked completed?" before
/// anything is written - both the moment the scene loads (so an already
/// finished lesson shows as done right away, button greyed out) and again
/// right before Execute() actually writes anything (in case the player
/// somehow clicks before that first check finishes). This is what stops
/// XP/points from being re-awarded every time a finished lesson is reopened -
/// disabling the button alone isn't enough, because Unity doesn't remember
/// that across a scene reload, only Firestore does.
///
/// SETUP:
/// - Put this script directly on the button GameObject.
/// - Set "Action Type" to whatever this button should do.
/// - Fill in only the fields that action needs (see the header comments
///   above each group - unused fields are simply ignored).
/// - In the Button component's OnClick() list, drag this same GameObject
///   in, and pick FirebaseButtonAction -> Execute().
///----------------------------------------------------------------------------------------------
public class FirebaseButtonAction : MonoBehaviour
{
    // Add new action types here as your game grows. Nothing else about this
    // script's structure needs to change when you do.
    public enum ActionType
    {
        CompleteLesson,
        CompleteQuiz,
        UnlockAchievement,
        UnlockItem,
        AddXp,
        AddPoints
    }

    [Header("What should this button do?")]
    public ActionType actionType;

    [Header("Used by: Complete Lesson, Complete Quiz")]
    public string subjectId;
    public string moduleId;
    public string lessonId;
    public string quizId;

    [Header("Optional reward on completion (leave 0 for none)")]
    [Tooltip("Awarded through GrantXp automatically when Complete Lesson / Complete Quiz succeeds. " +
             "Correctly handles leveling up, unlike a plain increment.")]
    public long xpReward;
    [Tooltip("Awarded via AddPoints automatically when Complete Lesson / Complete Quiz succeeds.")]
    public long pointsReward;

    [Header("Used by: Complete Quiz")]
    public long score;
    public long elapsedTimeSeconds;

    [Header("Used by: Unlock Achievement")]
    public string achievementId;
    public string achievementTitle;

    [Header("Used by: Unlock Item")]
    public string itemId;
    public string itemName;

    [Header("Used by: Add Xp, Add Points")]
    public long amount;

    [Header("Optional feedback (leave empty if you don't need it)")]
    public Button button;               // auto-disabled while the request is in flight
    public TMP_Text feedbackText;        // shows "Saved!" or an error

    [Header("Optional: make THIS button change its own look on success")]
    [Tooltip("This is separate from LessonButtonController - use this if you want the " +
             "Complete button itself (not the lesson-map icons) to visually flip to a " +
             "\"done\" state right after it's clicked, or immediately on load if it " +
             "turns out this lesson/quiz was already completed before.")]
    public Image selfImage;
    public Sprite successSprite;
    public TMP_Text selfLabel;
    public string successLabel = "Completed";
    [Tooltip("Turn on for one-time actions like Complete Lesson, so it can't be triggered twice " +
             "in the same session (which would otherwise re-add XP/points every click). Already-" +
             "completed lessons/quizzes are always locked out regardless of this setting.")]
    public bool disableAfterSuccess;

    [SerializeField] private PlayerLobbyUI playerLobbyUI;
    [SerializeField] private XPBar XPBar;

    /// <summary>
    /// Fires after ANY FirebaseButtonAction anywhere finishes successfully.
    /// Other scripts (like LessonButtonController) can subscribe to this to
    /// react instantly, instead of waiting for a fresh scene load.
    /// The string parameter is whichever ID is relevant to that action
    /// (lessonId for CompleteLesson, quizId for CompleteQuiz, etc).
    /// </summary>
    public static event Action<ActionType, string> OnActionCompleted;

    /// <summary>
    /// On load, if this button completes a lesson/quiz, check whether that
    /// lesson/quiz is already marked done - and if so, show the completed
    /// look immediately instead of waiting for a click.
    /// </summary>
    private async void Start()
    {
        if (actionType != ActionType.CompleteLesson && actionType != ActionType.CompleteQuiz)
        {
            return;
        }

        string userId = FirebaseManager.Instance?.Auth?.CurrentUser?.UserId;
        if (string.IsNullOrEmpty(userId)) return;

        bool alreadyDone = await IsAlreadyCompleted(userId);
        if (alreadyDone)
        {
            ApplySelfSuccessVisual(forceDisable: true);
        }
    }

    /// <summary>
    /// Wire this to the button's OnClick() in the Inspector.
    /// </summary>
    public async void Execute()
    {
        if (button != null) button.interactable = false;
        if (feedbackText != null) feedbackText.text = "";

        string userId = FirebaseManager.Instance?.Auth?.CurrentUser?.UserId;
        if (string.IsNullOrEmpty(userId))
        {
            ShowResult(false, "Not logged in.");
            return;
        }

        bool success = false;
        string affectedId = null;
        bool alreadyCompleted = false;

        // Each case below just calls into your existing FirestoreManager -
        // this script doesn't talk to Firestore directly for the actual
        // writes, it just routes button clicks to the right existing method.
        switch (actionType)
        {
            case ActionType.CompleteLesson:
                affectedId = lessonId;
                if (await IsAlreadyCompleted(userId))
                {
                    success = true;
                    alreadyCompleted = true;
                    break;
                }
                success = await FirestoreManager.Instance.CompleteLesson(userId, subjectId, moduleId, lessonId);
                if (success)
                {
                    await FirestoreManager.Instance.IncrementCompletedLessons(userId, subjectId, moduleId);
                    await GrantOptionalReward(userId);
                }
                break;

            case ActionType.CompleteQuiz:
                affectedId = quizId;
                if (await IsAlreadyCompleted(userId))
                {
                    success = true;
                    alreadyCompleted = true;
                    break;
                }
                success = await FirestoreManager.Instance.CompleteQuiz(
                    userId, subjectId, moduleId, quizId, score, elapsedTimeSeconds);
                if (success)
                {
                    await FirestoreManager.Instance.IncrementCompletedQuizzes(userId, subjectId, moduleId);
                    await GrantOptionalReward(userId);
                }
                break;

            case ActionType.UnlockAchievement:
                success = await FirestoreManager.Instance.UnlockAchievement(userId, achievementId, achievementTitle);
                affectedId = achievementId;
                break;

            case ActionType.UnlockItem:
                success = await FirestoreManager.Instance.UnlockItem(userId, itemId, itemName);
                affectedId = itemId;
                break;

            case ActionType.AddXp:
                success = (await FirestoreManager.Instance.GrantXp(userId, amount)).Success;
                break;

            case ActionType.AddPoints:
                success = await FirestoreManager.Instance.AddPoints(userId, amount);
                break;
        }

        string message = !success
            ? "Something went wrong. Try again."
            : (alreadyCompleted ? "Already completed." : "COMPLETED!");
        ShowResult(success, message);

        if (success)
        {
            ApplySelfSuccessVisual(forceDisable: alreadyCompleted);
            OnActionCompleted?.Invoke(actionType, affectedId);
            playerLobbyUI.RefreshPlayerData();
            XPBar.RefreshPlayerData();
        }
    }

    /// <summary>
    /// Checks Firestore directly for whether THIS lesson (or quiz) is already
    /// marked completed. This is the actual source of truth - not any local
    /// bool, since Unity doesn't remember button state across scene reloads.
    /// </summary>
    private async Task<bool> IsAlreadyCompleted(string userId)
    {
        string path = actionType == ActionType.CompleteQuiz ? QuizPath(userId) : LessonPath(userId);
        DocumentSnapshot doc = await FirestoreManager.Instance.GetDocument(path);
        return doc != null && doc.ContainsField("completed") && doc.GetValue<bool>("completed");
    }

    private string LessonPath(string userId) =>
        $"Users/{userId}/Subjects/{subjectId}/Modules/{moduleId}/Lessons/{lessonId}";

    private string QuizPath(string userId) =>
        $"Users/{userId}/Subjects/{subjectId}/Modules/{moduleId}/Quizzes/{quizId}";

    /// <summary>
    /// Awards xpReward / pointsReward (if set above 0) right after a
    /// Complete Lesson / Complete Quiz call succeeds. Uses GrantXp so
    /// leveling up is handled correctly instead of just raising a raw number.
    /// </summary>
    private async Task GrantOptionalReward(string userId)
    {
        if (xpReward > 0)
        {
            await FirestoreManager.Instance.GrantXp(userId, xpReward);
        }
        if (pointsReward > 0)
        {
            await FirestoreManager.Instance.AddPoints(userId, pointsReward);
        }
    }

    private void ShowResult(bool success, string message)
    {
        // Re-enable first - ApplySelfSuccessVisual (below) will disable it
        // again afterwards if disableAfterSuccess/forceDisable calls for it.
        if (button != null) button.interactable = true;
        if (feedbackText != null) feedbackText.text = message;

        if (!success)
        {
            Debug.LogWarning($"FirebaseButtonAction ({actionType}) failed: {message}");
        }
    }

    private void ApplySelfSuccessVisual(bool forceDisable = false)
    {
        if (selfImage != null && successSprite != null) selfImage.sprite = successSprite;
        if (selfLabel != null) selfLabel.text = successLabel;
        if ((disableAfterSuccess || forceDisable) && button != null) button.interactable = false;
    }
}