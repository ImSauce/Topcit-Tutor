using System.Collections.Generic;
using UnityEngine;

public class UIVisibility : MonoBehaviour
{
    [Header("Settings")]
    [SerializeField] private bool showWhenNoHideRequests = true;

    private HashSet<Object> hideSources = new HashSet<Object>();

    public void Hide(Object source)
    {
        if (source == null)
            return;

        hideSources.Add(source);
        UpdateVisibility();
    }

    public void Show(Object source)
    {
        if (source == null)
            return;

        hideSources.Remove(source);
        UpdateVisibility();
    }

    private void UpdateVisibility()
    {
        if (hideSources.Count > 0)
        {
            gameObject.SetActive(false);
        }
        else if (showWhenNoHideRequests)
        {
            gameObject.SetActive(true);
        }
    }
}