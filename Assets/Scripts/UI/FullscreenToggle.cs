using UnityEngine;

public class FullscreenToggle : MonoBehaviour
{
    [Header("Shortcut")]
    [SerializeField] private KeyCode shortcutKey = KeyCode.F;

    [Header("Hide When Fullscreen")]
    [SerializeField] private GameObject[] hideTargets;

    [Header("Show When Fullscreen")]
    [SerializeField] private GameObject[] showTargets;

    private bool isFullscreen = false;

    private void Update()
    {
        if (Input.GetKeyDown(shortcutKey))
        {
            ToggleFullscreen();
        }
    }

    private void ToggleFullscreen()
    {
        if (isFullscreen)
        {
            ExitFullscreen();
        }
        else
        {
            EnterFullscreen();
        }
    }

    private void EnterFullscreen()
    {
        // Hide normal UI
        foreach (GameObject target in hideTargets)
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

        // Show fullscreen-only UI
        foreach (GameObject target in showTargets)
        {
            if (target != null)
            {
                target.SetActive(true);
            }
        }

        isFullscreen = true;
    }

    private void ExitFullscreen()
    {
        // Remove fullscreen's hide request
        foreach (GameObject target in hideTargets)
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

        // Hide fullscreen-only UI
        foreach (GameObject target in showTargets)
        {
            if (target != null)
            {
                target.SetActive(false);
            }
        }

        isFullscreen = false;
    }
}