using UnityEngine;

public class PointFilter : MonoBehaviour
{
    void Awake()
    {
        Renderer[] renderers = GetComponentsInChildren<Renderer>(true);

        foreach (Renderer renderer in renderers)
        {
            foreach (Material material in renderer.materials)
            {
                Texture2D texture = material.mainTexture as Texture2D;

                if (texture != null)
                {
                    texture.filterMode = FilterMode.Point;
                }
            }
        }
    }
}