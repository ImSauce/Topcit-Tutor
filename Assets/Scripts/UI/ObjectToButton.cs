using UnityEngine;
using UnityEngine.Events;

public class ObjectToButton : MonoBehaviour
{
    [SerializeField] private GameObject ButtonObject;
    public UnityEvent unityEvent = new UnityEvent();
    
    void Start()
    {
        ButtonObject = this.gameObject;
    }
    void Update()
    {
        Ray ray = Camera.main.ScreenPointToRay(Input.mousePosition);
        RaycastHit hit;
        if(Input.GetMouseButtonDown(0))
        {
            if (Physics.Raycast(ray, out hit))
            {
                if (hit.transform.gameObject == ButtonObject)
                {
                    unityEvent.Invoke();
                }
            }
        }
    }
}
