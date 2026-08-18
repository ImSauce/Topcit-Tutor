using UnityEngine;

public class AnimationToggles : MonoBehaviour
{
    
    public Animator animator;

    public void CloseUIDuringOutro()
    {
        animator.SetTrigger("Close_UI_Outro");
    }

    public void DisableUI()
    {
        gameObject.SetActive(false);
    }
}
