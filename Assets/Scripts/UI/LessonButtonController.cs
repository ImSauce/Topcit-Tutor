using System;
using System.Threading.Tasks;
using Firebase.Firestore;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

///----------------------------------------------------------------------------------------------
/// WHAT THIS SCRIPT DOES (in plain English):
///
/// Put this on EVERY lesson button in your lesson map. It figures out, using
/// Firestore as the source of truth, whether this lesson should currently
/// show as Locked, Unlocked, or Completed - and updates the button's image
/// and text to match.
///
/// You build a chain (Lesson 1 -> Lesson 2 -> Lesson 3 -> ...) purely by
/// dragging each lesson's controller into the next one's "Previous Lesson"
/// slot in the Inspector. No code changes needed per lesson - the same
/// script works for all of them, just with different Inspector values.
///
/// RULES THIS SCRIPT FOLLOWS:
/// - If "Previous Lesson" is left empty, this lesson is always unlocked
///   (use this for Lesson 1 / the first lesson in a subject).
/// - Otherwise, this lesson is unlocked only once the previous lesson's
///   "completed" field is true in Firestore.
/// - Once a lesson is completed, its button stays clickable (so players can
///   revisit it) but shows the "completed" visual state instead of "locked"
///   or "unlocked".
///
/// SETUP:
/// - Put this script on the lesson button GameObject.
/// - Fill in subjectId / moduleId / lessonId to match this lesson's path
///   in Firestore (see your Users/{uid}/Subjects/.../Lessons/{lessonId} structure).
/// - Drag the PREVIOUS lesson's LessonButtonController into "Previous Lesson"
///   (leave empty for the first lesson in the sequence).
/// - Assign Button / Button Image / Button Text, and the three sprites/labels
///   for locked / unlocked / completed.
///----------------------------------------------------------------------------------------------
public class LessonButtonController : MonoBehaviour
{
    private enum VisualState { Locked, Unlocked, Completed }

    [Header("Firestore identity (must match your database path)")]
    public string subjectId;
    public string moduleId;
    public string lessonId;

    [Header("Sequence - leave empty for the FIRST lesson")]
    public LessonButtonController previousLesson;

    [Header("UI references")]
    public Button button;
    public Image buttonImage;
    public TMP_Text buttonText;

    [Header("Locked visuals")]
    public Sprite lockedSprite;
    public string lockedLabel = "Locked";

    [Header("Unlocked visuals")]
    public Sprite unlockedSprite;
    public string unlockedLabel = "Read";

    [Header("Completed visuals")]
    public Sprite completedSprite;
    public string completedLabel = "Review";

    // Cached so multiple callers (this lesson's own OnEnable, and the NEXT
    // lesson checking whether IT should unlock) don't each trigger their
    // own separate Firestore read - everyone shares one in-flight/finished task.
    private Task<bool> completionTask;

    /// <summary>
    /// Fires whenever this lesson's completed-state becomes known or changes,
    /// so the NEXT lesson in the chain can react immediately instead of only
    /// picking up the change on its own next scene load.
    /// </summary>
    public event Action<bool> OnCompletionChanged;

    private void OnEnable()
    {
        FirebaseButtonAction.OnActionCompleted += HandleFirebaseActionCompleted;
        if (previousLesson != null)
        {
            previousLesson.OnCompletionChanged += HandlePreviousLessonChanged;
        }

        Refresh();
    }

    private void OnDisable()
    {
        FirebaseButtonAction.OnActionCompleted -= HandleFirebaseActionCompleted;
        if (previousLesson != null)
        {
            previousLesson.OnCompletionChanged -= HandlePreviousLessonChanged;
        }
    }

    /// <summary>
    /// Re-reads this lesson's own completion status from Firestore, then
    /// (if this isn't the first lesson) waits to know whether the previous
    /// lesson is completed before deciding locked-vs-unlocked. Safe to call
    /// more than once - Unity's execution order across GameObjects isn't
    /// guaranteed, so this pattern avoids reading stale data.
    /// </summary>
    public async void Refresh()
    {
        bool isCompleted = await GetOwnCompletionStatus();
        bool previousDone = previousLesson == null || await previousLesson.GetOwnCompletionStatus();

        VisualState state = isCompleted
            ? VisualState.Completed
            : (previousDone ? VisualState.Unlocked : VisualState.Locked);

        ApplyVisualState(state);
    }

    /// <summary>
    /// Returns this lesson's "completed" value from Firestore. Cached per
    /// enable so asking twice (e.g. once from this lesson, once from the
    /// next lesson checking its prerequisite) only costs one read.
    /// </summary>
    public Task<bool> GetOwnCompletionStatus()
    {
        if (completionTask == null)
        {
            completionTask = FetchCompletionFromFirestore();
        }
        return completionTask;
    }

    private async Task<bool> FetchCompletionFromFirestore()
    {
        string userId = FirebaseManager.Instance?.Auth?.CurrentUser?.UserId;
        if (string.IsNullOrEmpty(userId)) return false;

        string path = $"Users/{userId}/Subjects/{subjectId}/Modules/{moduleId}/Lessons/{lessonId}";
        DocumentSnapshot doc = await FirestoreManager.Instance.GetDocument(path);

        bool completed = doc != null && doc.ContainsField("completed") && doc.GetValue<bool>("completed");
        OnCompletionChanged?.Invoke(completed);
        return completed;
    }

    private void ApplyVisualState(VisualState state)
    {
        switch (state)
        {
            case VisualState.Locked:
                DisableButton();
                if (button != null) button.interactable = false;
                if (buttonImage != null && lockedSprite != null) buttonImage.sprite = lockedSprite;
                if (buttonText != null) buttonText.text = lockedLabel;
                break;

            case VisualState.Unlocked:
                if (button != null) button.interactable = true;
                if (buttonImage != null && unlockedSprite != null) buttonImage.sprite = unlockedSprite;
                if (buttonText != null) buttonText.text = unlockedLabel;
                break;

            case VisualState.Completed:
                if (button != null) button.interactable = true; // still clickable so players can revisit
                if (buttonImage != null && completedSprite != null) buttonImage.sprite = completedSprite;
                if (buttonText != null) buttonText.text = completedLabel;
                break;
        }
    }

    // =========================================================
    // EVENT HANDLERS - these are what make the chain "automatic"
    // =========================================================

    /// <summary>
    /// Called when the lesson directly before this one finishes loading (or
    /// changing) its own completion status. If it just became completed,
    /// this lesson re-checks whether it should unlock now.
    /// </summary>
    private void HandlePreviousLessonChanged(bool previousIsCompleted)
    {
        completionTask = null; // force a fresh check rather than reusing an old cached result
        Refresh();
    }

    /// <summary>
    /// Called whenever ANY FirebaseButtonAction anywhere finishes. If it was
    /// a CompleteLesson action for THIS lesson's ID, refresh immediately
    /// instead of waiting for a scene reload.
    /// </summary>
    private void HandleFirebaseActionCompleted(FirebaseButtonAction.ActionType actionType, string affectedId)
    {
        if (actionType == FirebaseButtonAction.ActionType.CompleteLesson && affectedId == lessonId)
        {
            completionTask = null;
            Refresh();
        }
    }

    public void DisableButton()
    {
        if (button != null)
        {
            button.interactable = false;

            // Prevent Unity's Button from changing the visual color
            ColorBlock colors = button.colors;
            colors.disabledColor = colors.normalColor;
            button.colors = colors;
        }
    }



}