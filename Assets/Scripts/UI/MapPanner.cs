using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>
/// Put this on the big "Content" panel that holds all your skill tree nodes
/// (Module 1, Lesson 1, Quiz 1, etc). The Content panel should be a child of
/// a smaller "Viewport" panel that has a Mask component on it, so anything
/// outside the Viewport is simply hidden from view.
///
/// This script lets the player click-and-drag anywhere on the Content panel
/// to slide it around, like panning a map. It stops the player from
/// dragging the map so far that they see empty space past its edges.
/// </summary>
[RequireComponent(typeof(RectTransform))]
public class MapPanner : MonoBehaviour, IBeginDragHandler, IDragHandler
{
    [Header("Assign the Viewport (the small visible window)")]
    public RectTransform viewport;

    [Header("How far past the edges the player is allowed to drag (in pixels)")]
    public float edgeBuffer = 50f;

    private RectTransform content; // this object's own RectTransform
    private Vector2 startPosition; // where Content began, used as the "home" reference point

    private void Awake()
    {
        content = GetComponent<RectTransform>();
    }

    private void Start()
    {
        // Remember wherever Content starts as the reference point.
        // This way the clamp works correctly no matter what anchors/pivot you used.
        startPosition = content.anchoredPosition;
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        // Nothing needed here right now, but Unity requires this method
        // to exist because of IBeginDragHandler. Left blank on purpose.
    }

    public void OnDrag(PointerEventData eventData)
    {
        // Move the content by however far the mouse/finger moved this frame.
        content.anchoredPosition += eventData.delta;

        ClampToViewport();
    }

    /// <summary>Stops the content from being dragged too far past its own edges.</summary>
    private void ClampToViewport()
    {
        // How much bigger the content is than the viewport, on each side.
        float extraWidth = content.rect.width - viewport.rect.width;
        float extraHeight = content.rect.height - viewport.rect.height;

        // Allow moving edgeBuffer past "home" in either direction, plus however
        // much room the extra size actually gives us to reveal.
        float minX = startPosition.x - Mathf.Max(extraWidth, 0) - edgeBuffer;
        float maxX = startPosition.x + Mathf.Max(extraWidth, 0) + edgeBuffer;

        float minY = startPosition.y - Mathf.Max(extraHeight, 0) - edgeBuffer;
        float maxY = startPosition.y + Mathf.Max(extraHeight, 0) + edgeBuffer;

        Vector2 pos = content.anchoredPosition;
        pos.x = Mathf.Clamp(pos.x, minX, maxX);
        pos.y = Mathf.Clamp(pos.y, minY, maxY);
        content.anchoredPosition = pos;
    }

    // =========================================================
    // EDITOR VISUAL HELPER — draws borders in the Scene view only.
    // This never runs in the actual built game, it's just for you
    // to see sizes while setting things up.
    // =========================================================

    private void OnDrawGizmos()
    {
        RectTransform rt = GetComponent<RectTransform>();
        if (rt == null) return;

        // Yellow box = the full size of this Content object (your "canvas").
        DrawRectGizmo(rt, Color.yellow);

        // Cyan box = the Viewport, so you can see how much bigger Content is.
        if (viewport != null)
        {
            DrawRectGizmo(viewport, Color.cyan);
        }

        // Magenta box = the actual drag limit (Content's edge PLUS the buffer).
        // This is the true border, you can never drag Content past this line.
        DrawExpandedRectGizmo(rt, edgeBuffer, Color.magenta);
    }

    private void DrawRectGizmo(RectTransform rt, Color color)
    {
        Vector3[] corners = new Vector3[4];
        rt.GetWorldCorners(corners);

        Gizmos.color = color;
        for (int i = 0; i < 4; i++)
        {
            Gizmos.DrawLine(corners[i], corners[(i + 1) % 4]);
        }
    }

    /// <summary>Draws a box the same shape as the RectTransform, but pushed outward by "buffer" on every side.</summary>
    private void DrawExpandedRectGizmo(RectTransform rt, float buffer, Color color)
    {
        Rect r = rt.rect; // the rectangle in the object's own local space

        // The 4 corners, each pushed outward by the buffer amount.
        Vector3 bottomLeft  = new Vector3(r.xMin - buffer, r.yMin - buffer, 0);
        Vector3 topLeft     = new Vector3(r.xMin - buffer, r.yMax + buffer, 0);
        Vector3 topRight    = new Vector3(r.xMax + buffer, r.yMax + buffer, 0);
        Vector3 bottomRight = new Vector3(r.xMax + buffer, r.yMin - buffer, 0);

        // Convert those local points into world space, matching the object's actual position/rotation/scale.
        Vector3[] corners =
        {
            rt.TransformPoint(bottomLeft),
            rt.TransformPoint(topLeft),
            rt.TransformPoint(topRight),
            rt.TransformPoint(bottomRight)
        };

        Gizmos.color = color;
        for (int i = 0; i < 4; i++)
        {
            Gizmos.DrawLine(corners[i], corners[(i + 1) % 4]);
        }
    }
}