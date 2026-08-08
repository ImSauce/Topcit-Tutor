using UnityEngine;
using UnityEngine.SceneManagement;

#if UNITY_EDITOR
using UnityEditor;
#endif

public class SceneLoader : MonoBehaviour
{
    [Header("Scene to Load")]
#if UNITY_EDITOR
    public SceneAsset sceneToLoad;
#endif

    private string sceneName;

    private void Awake()
    {
#if UNITY_EDITOR
        if (sceneToLoad != null)
        {
            sceneName = sceneToLoad.name;
        }
#endif
    }

    // Loads the assigned scene
    public void LoadScene()
    {
        if (string.IsNullOrEmpty(sceneName))
        {
            Debug.LogWarning("No scene has been assigned.");
            return;
        }

        SceneManager.LoadScene(sceneName);
    }
}
