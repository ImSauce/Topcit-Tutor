using UnityEngine;
using TMPro;

/// <summary>
/// Put this on every answer cube.
/// It knows which answer it holds, and tells the QuizManager when the player shoots it.
/// </summary>
public class AnswerTarget : MonoBehaviour
{
    [Header("Set automatically when the cube is spawned")]
    [HideInInspector] public bool isCorrectAnswer;
    public TMP_Text answerLabel; // the 3D text sitting on this cube

    /// <summary>
    /// Call this from your shooting script when a raycast/bullet hits this cube.
    /// Example inside your shooting script:
    ///   AnswerTarget target = hit.collider.GetComponent<AnswerTarget>();
    ///   if (target != null) target.GetShot();
    /// </summary>
    public void GetShot()
    {
        // Tell the quiz manager "this cube got shot, here is what it was holding"
        QuizManager.Instance.OnAnswerShot(this);
    }
}