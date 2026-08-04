#if UNITY_EDITOR
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;

namespace TetraCreations.Attributes.Editor
{
	public class ContextMenuToggleButtonsEditor
	{
        private const string _tetraAttributesSymbol  = "TETRA_ATTRIBUTES_DISABLE_BUTTONS_EDITOR";

        [MenuItem("Window/Tetra Creations/Tetra Attributes/Disable Buttons Editor")]
        static void DisableDefaultEditorOverride()
        {
            List<string> defineSymbols = GetScriptingDefineSymbols();

            if (defineSymbols.Contains(_tetraAttributesSymbol)) { return; }

            defineSymbols.Add(_tetraAttributesSymbol);

            SetScriptingDefineSymbols(defineSymbols);
        }

        [MenuItem("Window/Tetra Creations/Tetra Attributes/Enable Buttons Editor")]
        static void EnableDefaultEditorOverride()
        {
            List<string> defineSymbols = GetScriptingDefineSymbols();

            if (defineSymbols.Contains(_tetraAttributesSymbol) == false) { return; }

            defineSymbols.Remove(_tetraAttributesSymbol);

            SetScriptingDefineSymbols(defineSymbols);
        }

        static List<string> GetScriptingDefineSymbols()
        {
            string definesString = PlayerSettings.GetScriptingDefineSymbols(CurrentNamedBuildTarget);
            return definesString.Split(';').ToList();
        }

        static void SetScriptingDefineSymbols(List<string> defineSymbols)
        {
            string symbols = string.Join(";", defineSymbols.ToArray());
            PlayerSettings.SetScriptingDefineSymbols(CurrentNamedBuildTarget, symbols);
        }

        static NamedBuildTarget CurrentNamedBuildTarget
        {
            get
            {
#if UNITY_SERVER
                return NamedBuildTarget.Server;
#else
                BuildTarget buildTarget = EditorUserBuildSettings.activeBuildTarget;
                BuildTargetGroup targetGroup = BuildPipeline.GetBuildTargetGroup(buildTarget);
                NamedBuildTarget namedBuildTarget = NamedBuildTarget.FromBuildTargetGroup(targetGroup);
                return namedBuildTarget;
#endif
            }
        }
    }
}
#endif