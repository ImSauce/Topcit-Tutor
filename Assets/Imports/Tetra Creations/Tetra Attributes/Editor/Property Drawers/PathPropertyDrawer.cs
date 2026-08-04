using System.IO;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

namespace TetraCreations.Attributes.Editor
{
    [CustomPropertyDrawer(typeof(PathReference))]
    public class PathPropertyDrawer : PropertyDrawer
    {
        private string _selectFolderLabel = "Select Folder";
        private string _invalidPathSubFolderText = "Invalid Path : Choose any folder inside the 'Assets' folder.";
        private string _unableToFindObject = "{0} cannot find referenced object in : '{1}'";

        private bool _initialized;
        private Object _obj;
        private SerializedProperty _guid = null;
        private SerializedProperty _path = null;
        private SerializedProperty _editable = null;
        private SerializedProperty _autoUpdate = null;
        private SerializedProperty _enableDebug = null;

        string _startingGUID;

        private bool Init(SerializedProperty property)
        {
            _initialized = false;

            _startingGUID = _guid.stringValue;
            _obj = AssetDatabase.LoadAssetAtPath<Object>(AssetDatabase.GUIDToAssetPath(_guid.stringValue));

            // Try to find the object using the path instead of the GUID
            if(_obj == null)
            {
                if (string.IsNullOrEmpty(_path.stringValue) == false)
                {
                    _obj = AssetDatabase.LoadAssetAtPath<Object>(_path.stringValue);
                }
            }

            // PathReference has a GUID and Path but the Asset doesn't exist anymore
            if (_obj == null && (_path.stringValue != "" || _guid.stringValue != ""))
            {
                if (_enableDebug.boolValue)
                {
                    Debug.LogWarning(string.Format(_unableToFindObject, nameof(PathReference), _path.stringValue));
                }

                // The Asset is missing we clear properties related to it
                if (_autoUpdate.boolValue)
                {
                    _path.stringValue = "";
                    _guid.stringValue = "";
                    GUI.changed = true;
                    property.serializedObject.ApplyModifiedProperties();
                    return true;
                }
            }

            _initialized = true;

            GUI.changed = false;

            return _initialized;
        }

        private bool TryToFindRelativeProperties(SerializedProperty property)
        {
            _guid = property.FindPropertyRelative("GUID");
            _path = property.FindPropertyRelative("_cachedPath");
            _editable = property.FindPropertyRelative("_editable");
            _autoUpdate = property.FindPropertyRelative("_autoUpdate");
            _enableDebug = property.FindPropertyRelative("_enableDebug");

            if (_guid == null || _path == null || _editable == null || _autoUpdate == null || _enableDebug == null)
            {
                return false;
            }

            return true;
        }

        /// <summary>
        /// Update the Object referenced using the GUID.<br></br>
        /// If the asset is missing and autoUpdate is true, the cached path and the GUID will be set to empty.
        /// </summary>
        /// <param name="property"></param>
        private void UpdateCurrentObject(SerializedProperty property)
        {
            if (string.IsNullOrEmpty(_guid.stringValue)) { return; }
            
            var currentObject = AssetDatabase.LoadAssetAtPath<Object>(AssetDatabase.GUIDToAssetPath(_guid.stringValue));

            if(currentObject == null)
            {
                if (_autoUpdate.boolValue)
                {
                    _path.stringValue = "";
                    _guid.stringValue = "";
                    property.serializedObject.ApplyModifiedProperties();
                    GUI.changed = true;
                }

                return;
            }

            if(_obj == currentObject) { return; }

            _obj = currentObject;
        }

        public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)
        {
            if (TryToFindRelativeProperties(property) == false) { return; }

            if (!_initialized) { Init(property); }

            if (_editable.boolValue == false)
            {
                GUI.enabled = false;
            }

            // Before drawing anything
            if(Event.current.type == EventType.Layout) { return; }

            EditorGUI.BeginChangeCheck();

            UpdateCurrentObject(property);

            // Get the object by it's GUID
            if (_obj == null && string.IsNullOrEmpty(_guid.stringValue) == false)
            {
                _obj = AssetDatabase.LoadAssetAtPath<Object>(AssetDatabase.GUIDToAssetPath(_guid.stringValue));
            }

            GUIContent guiContent = EditorGUIUtility.ObjectContent(_obj, typeof(DefaultAsset));

            Rect r = EditorGUI.PrefixLabel(position, label);

            Rect textFieldRect = r;
            textFieldRect.width -= 19f;

            GUIStyle textFieldStyle = new GUIStyle("TextField")
            {
                imagePosition = _obj ? ImagePosition.ImageLeft : ImagePosition.TextOnly
            };

            if (GUI.Button(textFieldRect, guiContent, textFieldStyle) && _obj)
            {
                EditorGUIUtility.PingObject(_obj);
            }

            // Apparently selecting or dragging a folder doesn't trigger any GUI changes.
            // We manually set GUI.Changed to true at the end if the string value of the "GUID" property changed (From PathReference)
            if (textFieldRect.Contains(Event.current.mousePosition))
            {
                if (Event.current.type == EventType.DragUpdated)
                {
                    Object reference = DragAndDrop.objectReferences[0];
                    string path = AssetDatabase.GetAssetPath(reference);
                    DragAndDrop.visualMode = Directory.Exists(path) ? DragAndDropVisualMode.Copy : DragAndDropVisualMode.Rejected;
                    Event.current.Use();
                }
                else if (Event.current.type == EventType.DragPerform)
                {
                    Object reference = DragAndDrop.objectReferences[0];
                    string path = AssetDatabase.GetAssetPath(reference);

                    if (PathUtility.TryToImportFolder(path))
                    {
                        _obj = reference;
                        _guid.stringValue = AssetDatabase.AssetPathToGUID(path);
                        property.serializedObject.ApplyModifiedProperties();
                    }

                    Event.current.Use();
                }
                else if (Event.current.type == EventType.KeyDown && Event.current.keyCode == KeyCode.Delete)
                {
                    _guid.stringValue = "";
                    _obj = null;
                    property.serializedObject.ApplyModifiedProperties();
                    Event.current.Use();
                }
            }

            Rect objectFieldRect = r;
            objectFieldRect.x = textFieldRect.xMax + 1f;
            objectFieldRect.width = 19f;

            if (GUI.Button(objectFieldRect, "", GUI.skin.GetStyle("IN ObjectField")))
            {
                string path = EditorUtility.OpenFolderPanel(_selectFolderLabel, "Assets", "");

                // User have cancelled folder selection
                if (string.IsNullOrEmpty(path))
                {
                    GUIUtility.ExitGUI();
                    return; 
                }

                // Make a relative path to use the AssetDatabase API
                var relative = PathUtility.ToRelative(path);

                // Folder is invalid if we cannot import it
                if (PathUtility.TryToImportFolder(relative))
                {
                    _obj = AssetDatabase.LoadAssetAtPath(relative, typeof(DefaultAsset));

                    _guid.stringValue = AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(_obj));
                    property.serializedObject.ApplyModifiedProperties();
                }
                else
                {
                    Debug.LogError(_invalidPathSubFolderText);
                }

                GUIUtility.ExitGUI();
            }

            // Force GUI change to update inspector of serializedObject.targetObject
            if (EditorGUI.EndChangeCheck() || _startingGUID != _guid.stringValue)
            {
                _path.stringValue = (_obj != null) ? AssetDatabase.GetAssetPath(_obj) : "";
                _path.serializedObject.ApplyModifiedProperties();
                _startingGUID = _guid.stringValue;
                GUI.changed = true;
            }

            GUI.enabled = true;
        }
    }
}