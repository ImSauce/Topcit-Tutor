using UnityEngine;

public class ShortcutScaleToggle : MonoBehaviour
{
    [Header("Shortcut")]
    [SerializeField] private KeyCode shortcutKey = KeyCode.F;

    [Header("Scale")]
    [SerializeField] private Vector3 expandedScale = new Vector3(1f, 1f, 1f);

    private RectTransform rectTransform;
    private Vector3 originalScale;
    private bool isExpanded = false;

    private void Awake()
    {
        rectTransform = GetComponent<RectTransform>();
        originalScale = rectTransform.localScale;
    }

    private void Update()
    {
        if (Input.GetKeyDown(shortcutKey))
        {
            ToggleScale();
        }
    }

    private void ToggleScale()
    {
        if (isExpanded)
        {
            rectTransform.localScale = originalScale;
            isExpanded = false;
        }
        else
        {
            rectTransform.localScale = expandedScale;
            isExpanded = true;
        }
    }
}