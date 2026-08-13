using UnityEngine;

/// <summary>
/// Makes a fixed camera feel "alive" by nudging its position AND rotation
/// slightly when the mouse gets close to the screen edges (desktop), or
/// when the player drags a finger across the screen (mobile).
///
/// HOW IT WORKS (plain language):
/// 1. We remember the camera's original position and rotation when the
///    game starts. This is our "home base" - we always move relative to
///    this, so the camera never drifts permanently.
/// 2. Every frame we work out a "push" value from -1 to 1 for both the
///    X and Y screen axes:
///      - Desktop: how close is the mouse to an edge? Center = 0 push,
///        right at the edge = 1 (or -1) push.
///      - Mobile: how far has the finger dragged from where it touched
///        down? More drag = more push, up to a max.
/// 3. We ease that push value smoothly using SmoothDamp (instead of a
///    plain Lerp) which gives it a more natural, slightly weighted feel
///    rather than a robotic "always moving at the same rate" motion.
/// 4. We turn that push into BOTH a small position shift and a small
///    rotation (tilt), which together read as a much more natural,
///    "looking around" motion than position alone.
/// 5. Vertical movement/rotation gets a smaller range than horizontal by
///    default, and looking DOWN specifically is squeezed even further,
///    so the camera never dips low enough to feel like it's losing its
///    framing.
/// 6. The whole effect can be enabled/disabled at runtime (e.g. from a
///    UI Button's OnClick) via EnableEffect() / DisableEffect() /
///    ToggleEffect() / SetEffectEnabled(bool). When disabled, the camera
///    smoothly eases back to its home base rather than snapping.
/// </summary>
public class CameraParallaxEffect : MonoBehaviour
{
    [Header("References")]
    [Tooltip("Leave empty to use the GameObject this script is attached to.")]
    [SerializeField] private Transform cameraTransform;

    [Header("Enable / Disable")]
    [Tooltip("Whether the parallax effect is active. Can also be toggled at runtime via EnableEffect() / DisableEffect() / ToggleEffect(), e.g. from a UI Button.")]
    [SerializeField] private bool effectEnabled = true;

    [Header("Movement Range")]
    [Tooltip("Max horizontal shift, in world units.")]
    [SerializeField] private float maxOffsetX = 0.5f;
 
    [Tooltip("Max vertical shift, in world units. Kept smaller than horizontal by default so the camera doesn't drift up/down as much.")]
    [SerializeField] private float maxOffsetY = 0.2f;
 
    [Tooltip("Multiplier applied to vertical movement only when the push is downward (0-1). Lower = looking down is more restricted than looking up.")]
    [SerializeField] [Range(0f, 1f)] private float downwardMoveDamping = 0.5f;
 
    [Header("Rotation (Tilt)")]
    [Tooltip("Max yaw rotation (turning left/right), in degrees.")]
    [SerializeField] private float maxYaw = 3f;
 
    [Tooltip("Max pitch rotation (tilting up/down), in degrees. Kept small so it stays subtle.")]
    [SerializeField] private float maxPitch = 1.5f;
 
    [Tooltip("Multiplier applied to downward pitch only (0-1). Lower = camera resists tilting down more than tilting up.")]
    [SerializeField] [Range(0f, 1f)] private float downwardPitchDamping = 0.4f;
 
    [Tooltip("Extra upward tilt (degrees) added whenever the camera pushes left or right. This is what makes sideways movement feel like a natural glance instead of a flat, robotic pan.")]
    [SerializeField] private float sidewaysUpTilt = 1f;
 
    [Header("Top-Center Look Up")]
    [Tooltip("Extra upward tilt (degrees) applied specifically when the cursor/finger sits near the top-CENTER of the screen. This is separate from the general vertical push above, and fades away if the cursor drifts toward the top corners.")]
    [SerializeField] private float topCenterUpTilt = 2f;
 
    [Tooltip("How far down from the very top of the screen (0-1, 1 = whole screen height) the top zone reaches. Higher = the look-up effect starts triggering sooner.")]
    [SerializeField] [Range(0f, 1f)] private float topZoneHeight = 0.3f;
 
    [Tooltip("How wide the 'center' band is, as a fraction of half the screen width (0-1). Higher = the look-up effect stays active even when further from dead-center horizontally.")]
    [SerializeField] [Range(0.05f, 1f)] private float centerZoneWidth = 0.35f;
 
    [Header("Feel / Smoothing")]
    [Tooltip("Roughly how long (in seconds) it takes the camera to catch up to a new target. Higher = floatier and more natural, lower = snappier.")]
    [SerializeField] private float smoothTime = 0.35f;
 
    [Header("Mouse Edge Look (Desktop)")]
    [Tooltip("How close to the screen edge (as a fraction of half-screen) the mouse must get before the camera starts reacting. Lower = starts reacting earlier.")]
    [SerializeField] [Range(0.01f, 0.5f)] private float edgeStartZone = 0.15f;
 
    [Header("Touch Drag (Mobile)")]
    [Tooltip("How many pixels of finger drag are needed to reach the full push range. Smaller number = more sensitive drag.")]
    [SerializeField] private float dragPixelsForMaxOffset = 300f;
 
    [Tooltip("How quickly the camera drifts back to center after the finger lifts off the screen.")]
    [SerializeField] private float dragRecoverySpeed = 2f;
 
    // "Home base" transform values - we always offset relative to these, never overwrite them.
    private Vector3 basePosition;
    private Quaternion baseRotation;
 
    // The raw target push value we're chasing this frame (-1 to 1 per axis).
    private Vector2 targetOffsetPercent;
 
    // The current, smoothed push value actually being applied.
    private Vector2 currentOffsetPercent;
 
    // SmoothDamp needs a persistent velocity per axis to know how to ease.
    private float velocityX;
    private float velocityY;
 
    // Raw accumulated drag amount from touch input (-1 to 1 per axis).
    private Vector2 touchDragPercent;
 
    // Tracks which finger we're following, so multi-touch doesn't confuse us.
    private int activeTouchId = -1;
    private Vector2 lastTouchPosition;
 
    // Raw pointer position in 0-1 viewport space, updated every frame from
    // whichever input (mouse or touch) is currently active. Used only for
    // the top-center look-up detector below, separate from the edge-push logic.
    private Vector2 pointerViewportPosition;
    private float topCenterCloseness; // 0 (not near top-center) to 1 (right at top-center)
 
    private void Awake()
    {
        // Default to this GameObject's transform if nothing was assigned in the Inspector.
        if (cameraTransform == null)
            cameraTransform = transform;
 
        basePosition = cameraTransform.localPosition;
        baseRotation = cameraTransform.localRotation;
    }
 
    private void Update()
    {
        if (effectEnabled)
        {
            // If there's an active touch, prioritize touch drag (this covers both
            // real mobile devices and testing with touch in the editor).
            if (Input.touchCount > 0)
            {
                targetOffsetPercent = HandleTouchDrag();
                pointerViewportPosition = new Vector2(
                    Input.GetTouch(0).position.x / Screen.width,
                    Input.GetTouch(0).position.y / Screen.height
                );
            }
            else
            {
                // No touch happening, fall back to mouse-edge behavior, and let
                // any leftover touch drag value ease back down to zero.
                targetOffsetPercent = HandleMouseEdge();
                touchDragPercent = Vector2.Lerp(touchDragPercent, Vector2.zero, Time.deltaTime * dragRecoverySpeed);
                pointerViewportPosition = new Vector2(
                    Input.mousePosition.x / Screen.width,
                    Input.mousePosition.y / Screen.height
                );
            }
        }
        else
        {
            // Effect is off: stop reading input and aim everything back at the
            // home base so the camera eases back smoothly instead of snapping.
            targetOffsetPercent = Vector2.zero;
            touchDragPercent = Vector2.Lerp(touchDragPercent, Vector2.zero, Time.deltaTime * dragRecoverySpeed);
            pointerViewportPosition = new Vector2(0.5f, 0.5f); // treat as screen-center -> no top-center pitch either
            activeTouchId = -1;
        }
 
        // SmoothDamp gives a more natural "catching up" feel than a plain Lerp -
        // it eases in and out rather than moving at a constant proportional rate.
        currentOffsetPercent.x = Mathf.SmoothDamp(currentOffsetPercent.x, targetOffsetPercent.x, ref velocityX, smoothTime);
        currentOffsetPercent.y = Mathf.SmoothDamp(currentOffsetPercent.y, targetOffsetPercent.y, ref velocityY, smoothTime);
 
        // This checks the pointer's ACTUAL position against the top-center of the
        // screen specifically (unlike the general edge-push above, which reacts to
        // any edge). It's what drives the dedicated look-up effect.
        topCenterCloseness = GetTopCenterCloseness(pointerViewportPosition);
 
        ApplyOffset(currentOffsetPercent);
    }

    // ---------------------------------------------------------------------
    // Enable / Disable controls - hook these up to a UI Button's OnClick().
    // ---------------------------------------------------------------------

    /// <summary>Turns the parallax effect on.</summary>
    public void EnableEffect()
    {
        SetEffectEnabled(true);
    }

    /// <summary>Turns the parallax effect off. The camera eases back to its home base.</summary>
    public void DisableEffect()
    {
        SetEffectEnabled(false);
    }

    /// <summary>Flips the effect between enabled and disabled. Handy for a single toggle button.</summary>
    public void ToggleEffect()
    {
        SetEffectEnabled(!effectEnabled);
    }

    /// <summary>
    /// Explicitly sets whether the effect is enabled. This is the one to use if you're
    /// wiring a Toggle UI element (Button OnClick supports a Dynamic bool argument too).
    /// </summary>
    public void SetEffectEnabled(bool value)
    {
        effectEnabled = value;
    }

    /// <summary>Whether the effect is currently enabled.</summary>
    public bool IsEffectEnabled => effectEnabled;
 
    /// <summary>
    /// Desktop: checks how close the mouse is to the screen edges and
    /// returns a -1 to 1 push value per axis.
    /// </summary>
    private Vector2 HandleMouseEdge()
    {
        // Convert the mouse position (in pixels) into a 0-1 range across the screen.
        Vector2 mouseViewport = new Vector2(
            Input.mousePosition.x / Screen.width,
            Input.mousePosition.y / Screen.height
        );
 
        // Distance from the exact center of the screen (0.5, 0.5).
        float distFromCenterX = mouseViewport.x - 0.5f;
        float distFromCenterY = mouseViewport.y - 0.5f;
 
        return new Vector2(GetPushAmount(distFromCenterX), GetPushAmount(distFromCenterY));
    }
 
    /// <summary>
    /// Converts a "distance from center" value (-0.5 to 0.5) into a push
    /// strength (-1 to 1). Nothing happens until you cross into edgeStartZone,
    /// so there's a comfortable dead zone in the middle of the screen.
    /// </summary>
    private float GetPushAmount(float distFromCenter)
    {
        float deadZoneEdge = 0.5f - edgeStartZone; // where the dead zone ends and the push zone begins
 
        if (Mathf.Abs(distFromCenter) < deadZoneEdge)
            return 0f; // still comfortably near the center, no push at all
 
        // Map the remaining distance (deadZoneEdge -> 0.5) onto a clean (0 -> 1) range.
        float sign = Mathf.Sign(distFromCenter);
        float strength = (Mathf.Abs(distFromCenter) - deadZoneEdge) / edgeStartZone;
        return sign * Mathf.Clamp01(strength);
    }
 
    /// <summary>
    /// Figures out how close the pointer (mouse or finger) is to the
    /// top-CENTER of the screen specifically - not just "near the top edge"
    /// like the general edge-push does. Returns 0 (not near top-center) to
    /// 1 (right at top-center). Fades out both as the pointer moves down
    /// AND as it drifts toward the top-left/top-right corners.
    /// </summary>
    private float GetTopCenterCloseness(Vector2 viewportPos)
    {
        // How far down the top zone we are: 1 at the very top edge,
        // 0 once we're below the top zone entirely.
        float topZoneStart = 1f - topZoneHeight;
        float verticalCloseness = Mathf.InverseLerp(topZoneStart, 1f, viewportPos.y);
 
        // How close to horizontal center: 1 at dead-center (x = 0.5),
        // fading to 0 once we're centerZoneWidth away from center.
        float distFromCenterX = Mathf.Abs(viewportPos.x - 0.5f);
        float horizontalCloseness = 1f - Mathf.Clamp01(distFromCenterX / (centerZoneWidth * 0.5f));
 
        // Both conditions need to be true at once - being at the top edge
        // but off in a corner shouldn't count as "top-center".
        return verticalCloseness * horizontalCloseness;
    }
 
    /// <summary>
    /// Mobile: follows a single finger drag and converts the drag distance
    /// into a -1 to 1 push value per axis.
    /// </summary>
    private Vector2 HandleTouchDrag()
    {
        Touch touch = Input.GetTouch(0);
 
        if (touch.phase == TouchPhase.Began)
        {
            // A new finger touched down - start tracking it from here.
            activeTouchId = touch.fingerId;
            lastTouchPosition = touch.position;
        }
        else if (touch.fingerId == activeTouchId &&
                 (touch.phase == TouchPhase.Moved || touch.phase == TouchPhase.Stationary))
        {
            Vector2 delta = touch.position - lastTouchPosition;
            lastTouchPosition = touch.position;
 
            // Turn the raw pixel movement into a percentage of our max drag distance.
            touchDragPercent += delta / dragPixelsForMaxOffset;
            touchDragPercent = Vector2.ClampMagnitude(touchDragPercent, 1f);
        }
        else if (touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled)
        {
            // Finger lifted - stop tracking. The Update loop eases
            // touchDragPercent back to zero once touchCount hits 0.
            activeTouchId = -1;
        }
 
        return touchDragPercent;
    }
 
    /// <summary>
    /// Applies the final push value as both a position shift and a small
    /// rotation, moving/rotating around the camera's own local axes so the
    /// effect stays correct no matter which way the fixed camera faces.
    /// Vertical motion (and especially downward motion) is squeezed to a
    /// smaller range than horizontal, per design intent.
    /// </summary>
    private void ApplyOffset(Vector2 offsetPercent)
    {
        // --- Position ---
        float verticalMoveScale = offsetPercent.y < 0f ? downwardMoveDamping : 1f;
        Vector3 rightOffset = cameraTransform.right * (offsetPercent.x * maxOffsetX);
        Vector3 upOffset = cameraTransform.up * (offsetPercent.y * maxOffsetY * verticalMoveScale);
        cameraTransform.localPosition = basePosition + rightOffset + upOffset;
 
        // --- Rotation ---
        float verticalTiltScale = offsetPercent.y < 0f ? downwardPitchDamping : 1f;
        float yaw = offsetPercent.x * maxYaw;
 
        // Pitch from vertical push - negative sign so pushing "up" tilts the view up
        // (Unity's +X rotation looks down).
        float verticalPitch = -offsetPercent.y * maxPitch * verticalTiltScale;
 
        // Extra upward pitch from sideways push - this is what stops left/right
        // movement from feeling like a flat pan. It always tilts UP regardless of
        // whether the push is left or right, hence Mathf.Abs.
        float sidewaysPitch = -Mathf.Abs(offsetPercent.x) * sidewaysUpTilt;
 
        // Dedicated upward tilt that only kicks in when the pointer is actually
        // near the top-center of the screen (see GetTopCenterCloseness). This is
        // on top of, not a replacement for, the two pitch sources above.
        float topCenterPitch = -topCenterCloseness * topCenterUpTilt;
 
        float pitch = verticalPitch + sidewaysPitch + topCenterPitch;
 
        cameraTransform.localRotation = baseRotation * Quaternion.Euler(pitch, yaw, 0f);
    }
}