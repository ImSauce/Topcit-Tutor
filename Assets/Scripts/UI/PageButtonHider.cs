using UnityEngine;

public class PageButtonHider : MonoBehaviour
{
    [SerializeField] private GameObject[] targets;

    private bool isHiding = false;

    public void ToggleUI()
    {
        if (isHiding)
        {
            ShowUI();
        }
        else
        {
            HideUI();
        }
    }

    private void HideUI()
    {
        foreach (GameObject target in targets)
        {
            if (target != null)
            {
                UIVisibility visibility = target.GetComponent<UIVisibility>();

                if (visibility != null)
                {
                    visibility.Hide(this);
                }
            }
        }

        isHiding = true;
    }

    private void ShowUI()
    {
        foreach (GameObject target in targets)
        {
            if (target != null)
            {
                UIVisibility visibility = target.GetComponent<UIVisibility>();

                if (visibility != null)
                {
                    visibility.Show(this);
                }
            }
        }

        isHiding = false;
    }
}