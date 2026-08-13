using UnityEngine;
using System.Collections;

public class TooltipSystem : MonoBehaviour
{
    private static TooltipSystem current;
    public Tooltip tooltip;

    private Coroutine hideCoroutine;

    private void Awake()
    {
        current = this;
        tooltip.gameObject.SetActive(false);
    }

    public static void Show(string content, string header = "")
    {
        if (current == null || current.tooltip == null)
            return;

        // Cancel any pending hide — we're still hovering something.
        if (current.hideCoroutine != null)
        {
            current.StopCoroutine(current.hideCoroutine);
            current.hideCoroutine = null;
        }

        current.tooltip.SetText(content, header);
        current.tooltip.gameObject.SetActive(true);
    }

    public static void Hide()
    {
        if (current == null || current.tooltip == null)
            return;

        if (current.hideCoroutine != null)
            current.StopCoroutine(current.hideCoroutine);

        current.hideCoroutine = current.StartCoroutine(current.HideNextFrame());
    }

    private IEnumerator HideNextFrame()
    {
        // Wait a frame so a same-frame/next-frame Show() from an adjacent
        // trigger can cancel this hide before it actually happens.
        yield return null;
        tooltip.gameObject.SetActive(false);
        hideCoroutine = null;
    }
}