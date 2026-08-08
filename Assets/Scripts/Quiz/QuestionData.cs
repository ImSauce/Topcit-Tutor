using UnityEngine;
using System.Collections.Generic;
using System.Collections;

// Stores one quiz question.
[System.Serializable]
public class Question
{
    // The question shown to the player.
    public string questionText;

    // The list of possible answers.
    public string[] replies;

    // The correct answer.
    // Starts at 0.
    // Example:
    // 0 = First answer
    // 1 = Second answer
    // 2 = Third answer
    // 3 = Fourth answer
    public int correctAnswerIndex;
}


// Lets you create a Question Data file
// by right-clicking in the Project window.
[CreateAssetMenu(fileName = "New Category", menuName = "Quiz/Question Data")]
public class QuestionData : ScriptableObject
{
    // The name of this quiz category.
    // Example: Programming, Networking, Math
    public string category;

    // All the questions that belong
    // to this category.
    public Question[] questions;
}