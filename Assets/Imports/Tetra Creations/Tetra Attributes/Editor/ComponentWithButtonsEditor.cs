using UnityEditor;

namespace TetraCreations.Attributes.Editor
{
    /// <summary>
    /// Custom editor for ComponentWithButtons, this will instantiate a ButtonsDrawer.<br></br>
    /// Inside OnInspectorGUI() it will simply draw the default inspector.<br></br>
    /// Then it will draw all buttons. <br></br>
    /// You need to inherit from this class if you want to display buttons inside your custom editor.
    /// </summary>
    [CustomEditor(typeof(ComponentWithButtons), true), CanEditMultipleObjects]
    public class ComponentWithButtonsEditor : UnityEditor.Editor
    {
        protected ButtonsDrawer _buttonsDrawer;

        protected virtual void OnEnable()
        {
            _buttonsDrawer = new ButtonsDrawer(target);
        }

        public override void OnInspectorGUI()
        {
            if (serializedObject == null) { return; }

            DrawDefaultInspector();

            DrawButtons();
        }

        public virtual void DrawButtons()
        {
            if (_buttonsDrawer != null)
            {
                _buttonsDrawer.DrawButtons(targets);
            }
        }
    }
}