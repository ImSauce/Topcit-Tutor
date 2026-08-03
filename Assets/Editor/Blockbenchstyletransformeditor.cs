using UnityEngine;
using UnityEditor;

// Place this script inside an "Editor" folder anywhere in your Assets
// (e.g. Assets/Editor/BlockbenchStyleTransformEditor.cs)
// It replaces the default Transform inspector with one that has a small
// colored square beside each X/Y/Z field, matching the colors of the
// scene view move/rotate/scale gizmo arrows (same convention Blockbench uses).

[CustomEditor(typeof(Transform))]
[CanEditMultipleObjects]
public class BlockbenchStyleTransformEditor : Editor
{
    // Tweak these to match your gizmo colors exactly if you've customized them
    // (Edit > Preferences > Colors > Scene Gizmos, or a color scheme asset).
    private static readonly Color ColorX = new Color(0.95f, 0.30f, 0.30f);
    private static readonly Color ColorY = new Color(0.45f, 0.90f, 0.45f);
    private static readonly Color ColorZ = new Color(0.35f, 0.55f, 0.98f);

    // Drag-to-scrub state (only one axis field can be dragged at a time,
    // so a single set of instance fields is enough).
    private int _dragControlId = -1;
    private float _dragStartValue;
    private float _dragStartMouseX;

    private Transform t;

    private void OnEnable()
    {
        t = (Transform)target;
    }

    public override void OnInspectorGUI()
    {
        EditorGUI.BeginChangeCheck();

        Vector3 position = t.localPosition;
        Vector3 rotation = t.localEulerAngles;
        Vector3 scale = t.localScale;

        DrawVector3Row("Position", ref position);
        DrawVector3Row("Rotation", ref rotation);
        DrawVector3Row("Scale", ref scale);

        if (EditorGUI.EndChangeCheck())
        {
            Undo.RecordObject(t, "Change Transform");
            t.localPosition = position;
            t.localEulerAngles = rotation;
            t.localScale = scale;
        }
    }

    private void DrawVector3Row(string label, ref Vector3 value)
    {
        Rect rowRect = EditorGUILayout.GetControlRect(false, 18f);
        float labelWidth = EditorGUIUtility.labelWidth;

        Rect labelRect = new Rect(rowRect.x, rowRect.y, labelWidth, rowRect.height);
        EditorGUI.LabelField(labelRect, label);

        float remaining = rowRect.width - labelWidth;
        float axisWidth = remaining / 3f;
        float x = rowRect.x + labelWidth;

        value.x = DrawAxisField(new Rect(x, rowRect.y, axisWidth, rowRect.height), "X", ColorX, value.x);
        x += axisWidth;
        value.y = DrawAxisField(new Rect(x, rowRect.y, axisWidth, rowRect.height), "Y", ColorY, value.y);
        x += axisWidth;
        value.z = DrawAxisField(new Rect(x, rowRect.y, axisWidth, rowRect.height), "Z", ColorZ, value.z);
    }

    private float DrawAxisField(Rect rect, string axisName, Color swatchColor, float value)
    {
        const float swatchSize = 10f;
        const float axisLabelWidth = 12f;

        Rect swatchRect = new Rect(rect.x, rect.y + (rect.height - swatchSize) / 2f, swatchSize, swatchSize);
        EditorGUI.DrawRect(swatchRect, swatchColor);

        Rect axisLabelRect = new Rect(swatchRect.xMax + 3f, rect.y, axisLabelWidth, rect.height);
        Rect fieldRect = new Rect(
            axisLabelRect.xMax + 2f,
            rect.y,
            rect.width - swatchSize - axisLabelWidth - 7f,
            rect.height);

        return DragAndFloatField(axisLabelRect, fieldRect, axisName, value);
    }

    // Recreates Unity's built-in "click and drag the X/Y/Z label to scrub the value" behavior.
    private float DragAndFloatField(Rect labelRect, Rect fieldRect, string axisName, float value)
    {
        int id = GUIUtility.GetControlID(FocusType.Passive);
        Event e = Event.current;

        EditorGUIUtility.AddCursorRect(labelRect, MouseCursor.SlideArrow);

        switch (e.GetTypeForControl(id))
        {
            case EventType.MouseDown:
                if (labelRect.Contains(e.mousePosition) && e.button == 0)
                {
                    GUIUtility.hotControl = id;
                    _dragControlId = id;
                    _dragStartValue = value;
                    _dragStartMouseX = e.mousePosition.x;
                    GUIUtility.keyboardControl = 0; // stop editing any active text field
                    e.Use();
                }
                break;

            case EventType.MouseDrag:
                if (GUIUtility.hotControl == id)
                {
                    float delta = e.mousePosition.x - _dragStartMouseX;

                    // Hold Shift to move faster, Ctrl/Cmd to move slower — same convention as Unity's own fields.
                    float sensitivity = 0.05f;
                    if (e.shift) sensitivity *= 10f;
                    if (e.control || e.command) sensitivity *= 0.1f;

                    value = _dragStartValue + delta * sensitivity;
                    GUI.changed = true;
                    e.Use();
                }
                break;

            case EventType.MouseUp:
                if (GUIUtility.hotControl == id)
                {
                    GUIUtility.hotControl = 0;
                    _dragControlId = -1;
                    e.Use();
                }
                break;
        }

        GUI.Label(labelRect, axisName);
        value = EditorGUI.FloatField(fieldRect, value);

        return value;
    }
}