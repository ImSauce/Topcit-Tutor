using UnityEngine;

public class AnimationToggles : MonoBehaviour
{
    
    public Animator animator;

    public void PlayGeminiUIOutro()
    {
        animator.SetTrigger("Close_Gemini_UI_Outro_Anim");
    }

    public void DisableUI()
    {
        gameObject.SetActive(false);
    }
}
