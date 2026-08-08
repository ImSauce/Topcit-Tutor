using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using TMPro;

/// <summary>
/// Runs one full quiz using a QuestionData asset.
///
/// How it works, step by step:
/// 1. Show the current question on the reusable question text.
/// 2. Spawn one answer cube per choice, each with its own text.
/// 3. Wait for the player to shoot one of the cubes (AnswerTarget calls us).
/// 4. Turn the question + the shot cube's text green (correct) or red (wrong).
/// 5. Wait 1 second so the player can see the color.
/// 6. Remove the old cubes, then either show the next question or end the quiz.
/// </summary>
public class QuizManager : MonoBehaviour
{
    public static QuizManager Instance { get; private set; }

    [Header("Quiz Data")]
    public QuestionData questionData;

    [Header("Question Display")]
    public TMP_Text questionText; // one reusable 3D text for the question

    [Header("Answer Setup")]
    public GameObject answerCubePrefab; // a cube with a TMP_Text child and an AnswerTarget component
    public Transform[] answerSpawnPoints; // where the answer cubes appear

    [Header("Colors")]
    public Color correctColor = Color.green;
    public Color wrongColor = Color.red;
    public float colorShowTime = 1f;

    // These 3 tell Firebase WHERE to save this quiz's result.
    // They must match the folder names you made in Firestore.
    // Example: subject_1 / module_1 / quiz_1
    [Header("Firebase Save Location")]
    public string subjectId;
    public string moduleId;
    public string quizId;

    private int currentQuestionIndex = 0;
    private List<GameObject> spawnedAnswers = new List<GameObject>();
    private Color questionDefaultColor;

    // Stops the player's shot from counting twice while we are showing the color / waiting
    private bool acceptingShots = true;

    // Keeps count of how many questions the player got right, for the score.
    private int correctAnswersCount = 0;

    // Remembers what time the quiz began, so we can measure how long it took.
    private float quizStartTime;

    private void Awake()
    {
        Instance = this;
    }

    private void Start()
    {
        questionDefaultColor = questionText.color;
        quizStartTime = Time.time; // start the stopwatch for this quiz
        ShowQuestion(currentQuestionIndex);
    }

    /// <summary>Displays the question at this index and spawns its answer cubes.</summary>
    private void ShowQuestion(int index)
    {
        Question question = questionData.questions[index];

        questionText.text = question.questionText;
        questionText.color = questionDefaultColor;

        SpawnAnswers(question);
        acceptingShots = true;
    }

    /// <summary>Creates one cube per answer choice, in a shuffled order, at the spawn points.</summary>
    private void SpawnAnswers(Question question)
    {
        // Make a shuffled list of answer indexes so the correct answer
        // is not always in the same spot.
        List<int> answerOrder = new List<int>();
        for (int i = 0; i < question.replies.Length; i++)
        {
            answerOrder.Add(i);
        }
        ShuffleList(answerOrder);

        for (int i = 0; i < answerOrder.Count && i < answerSpawnPoints.Length; i++)
        {
            int answerIndex = answerOrder[i];

            GameObject cube = Instantiate(answerCubePrefab, answerSpawnPoints[i].position, answerSpawnPoints[i].rotation);
            spawnedAnswers.Add(cube);

            AnswerTarget target = cube.GetComponent<AnswerTarget>();
            target.answerLabel.text = question.replies[answerIndex];
            target.answerLabel.color = Color.white; // reset color on every new cube
            target.isCorrectAnswer = (answerIndex == question.correctAnswerIndex);
        }
    }

    /// <summary>Called by AnswerTarget when the player shoots that cube.</summary>
    public void OnAnswerShot(AnswerTarget target)
    {
        if (!acceptingShots) return; // ignore extra shots while we are already handling one
        acceptingShots = false;

        Color resultColor = target.isCorrectAnswer ? correctColor : wrongColor;

        // Turn both the question and the shot answer the result color
        questionText.color = resultColor;
        target.answerLabel.color = resultColor;

        // Keep score, and log it for analytics
        if (target.isCorrectAnswer)
        {
            correctAnswersCount++;
            AnalyticsManager.CorrectAnswer();
        }
        else
        {
            AnalyticsManager.WrongAnswer();
        }

        StartCoroutine(NextQuestionAfterDelay());
    }

    /// <summary>Waits a moment so the player can see the color, then moves on.</summary>
    private IEnumerator NextQuestionAfterDelay()
    {
        yield return new WaitForSeconds(colorShowTime);

        RemoveAnswerCubes();

        currentQuestionIndex++;

        if (currentQuestionIndex < questionData.questions.Length)
        {
            ShowQuestion(currentQuestionIndex);
        }
        else
        {
            QuizFinished();
        }
    }

    /// <summary>Destroys the current answer cubes so new ones can be spawned.</summary>
    private void RemoveAnswerCubes()
    {
        foreach (GameObject cube in spawnedAnswers)
        {
            Destroy(cube);
        }
        spawnedAnswers.Clear();
    }

    /// <summary>Called once there are no questions left. Saves the result to Firebase.</summary>
    private async void QuizFinished()
    {
        questionText.text = "Quiz Complete!";
        questionText.color = questionDefaultColor;

        // Figure out how many seconds the whole quiz took.
        int elapsedSeconds = Mathf.RoundToInt(Time.time - quizStartTime);

        // Get the ID of the player who is currently logged in.
        string userId = FirebaseManager.Instance.Auth.CurrentUser.UserId;

        // Save the score and time for this quiz into Firestore.
        await FirestoreManager.Instance.CompleteQuiz(
            userId, subjectId, moduleId, quizId, correctAnswersCount, elapsedSeconds);

        // Tell the module "one more quiz was finished" so its counter goes up.
        await FirestoreManager.Instance.IncrementCompletedQuizzes(userId, subjectId, moduleId);

        // Reward the player with some xp and points based on how many they got right.
        // Feel free to change these numbers to whatever feels fair for your game.
        await FirestoreManager.Instance.AddXp(userId, correctAnswersCount * 10);
        await FirestoreManager.Instance.AddPoints(userId, correctAnswersCount * 5);

        // Log this finished quiz for analytics too.
        AnalyticsManager.QuizCompleted(quizId, correctAnswersCount, elapsedSeconds);
    }

    /// <summary>Puts a list of numbers in random order (simple shuffle).</summary>
    private void ShuffleList(List<int> list)
    {
        for (int i = 0; i < list.Count; i++)
        {
            int randomIndex = Random.Range(i, list.Count);
            int temp = list[i];
            list[i] = list[randomIndex];
            list[randomIndex] = temp;
        }
    }
}