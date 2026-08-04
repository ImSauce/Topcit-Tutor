using UnityEditor;
using UnityEngine;

namespace TetraCreations.Attributes.Editor
{
    [CustomPropertyDrawer(typeof(TagsAttribute))]
    public class TagsPropertyDrawer : PropertyDrawer
    {
        private const string _defaultTag = "Untagged";

        public override void OnGUI(Rect position, SerializedProperty property, GUIContent label)
        {
            if (property.propertyType == SerializedPropertyType.String)
            {
                EditorGUI.BeginProperty(position, label, property);

                if(property.stringValue == "")
                {
                    property.stringValue = _defaultTag;
                }

                property.stringValue = EditorGUI.TagField(position, label, property.stringValue);

                EditorGUI.EndProperty();
            }
            else
            {
                EditorGUI.PropertyField(position, property, label);
            }
        }
    }
}
