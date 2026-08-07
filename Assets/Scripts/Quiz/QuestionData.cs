using UnityEngine;
using System.Collections.Generic;
using System.Collections;

[System.Serializable]
public class Question
{
    public string questionText;
    public string [] replies;
    public int correctAnswerIndex;
    
}

[CreateAssetMenu(fileName = "New Category", menuName = "Quiz/Question Data")]

public class QuestionData : ScriptableObject
{
    public string category;
    public Question[] questions;
}
