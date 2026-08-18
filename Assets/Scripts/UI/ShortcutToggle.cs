using UnityEngine;

public class ShortcutToggle : MonoBehaviour
{
    [Header("Shortcut")]
    [SerializeField] private KeyCode shortcutKey = KeyCode.F;

    [Header("Targets")]
    [SerializeField] private GameObject[] targets;

    private void Update()
    {
        if (Input.GetKeyDown(shortcutKey))
        {
            ToggleTargets();
        }
    }

    private void ToggleTargets()
    {
        foreach (GameObject target in targets)
        {
            if (target != null)
            {
                target.SetActive(!target.activeSelf);
            }
        }
    }
}