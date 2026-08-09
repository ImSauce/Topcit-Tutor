using UnityEngine;

/// <summary>
/// Put this on any GameObject (a "UI Manager" empty object works fine).
/// Drag whatever UI panel you want to zoom into the "Target" slot below.
///
/// This scales the panel using its Scale values (the same 3 boxes you see
/// under "Scale" at the top of the Inspector). Scaling the whole panel at
/// once means everything inside it grows or shrinks together evenly —
/// like using the Scale tool on an object in the Unity Editor.
/// </summary>
public class ZoomManager : MonoBehaviour
{
    [Header("The UI panel you want to zoom")]
    public RectTransform target;

    [Header("Zoom Settings")]
    public float zoomSpeed = 0.1f; // how much scrolling the mouse wheel changes the zoom
    public float minZoom = 0.5f;   // smallest allowed size (half size)
    public float maxZoom = 2f;     // biggest allowed size (double size)

    private float currentZoom = 1f;

    private void Awake()
    {
        // IMPORTANT: for this to scale evenly from the middle (instead of
        // sliding sideways from a corner), Target's Pivot should be set to
        // X: 0.5, Y: 0.5 in the Inspector. Check this if zoom looks off.
        currentZoom = target.localScale.x;
    }

    private void Update()
    {
        float scrollInput = Input.GetAxis("Mouse ScrollWheel");

        if (scrollInput != 0f)
        {
            SetZoom(currentZoom + (scrollInput * zoomSpeed * 10f));
        }
    }

    /// <summary>Call this from a "Zoom In" button's OnClick, if you'd rather use buttons instead of the mouse wheel.</summary>
    public void ZoomIn()
    {
        SetZoom(currentZoom + zoomSpeed);
    }

    /// <summary>Call this from a "Zoom Out" button's OnClick.</summary>
    public void ZoomOut()
    {
        SetZoom(currentZoom - zoomSpeed);
    }

    /// <summary>Sets the zoom to an exact value, e.g. from a Slider's OnValueChanged.</summary>
    public void SetZoom(float newZoom)
    {
        currentZoom = Mathf.Clamp(newZoom, minZoom, maxZoom);
        target.localScale = new Vector3(currentZoom, currentZoom, 1f);
    }
}