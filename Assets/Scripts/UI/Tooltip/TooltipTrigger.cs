

// using UnityEngine;
// using UnityEngine.EventSystems;

// public class TooltipTrigger : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
// {

//     public string header;
//     public string content;


//     public void OnPointerEnter(PointerEventData eventData)
//     {
//         TooltipSystem.Show(content, header);
//     }

//     public void OnPointerExit(PointerEventData eventData)
//     {
//         TooltipSystem.Hide();
//     }

//         public void OnMouseEnter()
//     {
//         TooltipSystem.Show(content, header);
//     }

//     public void OnMouseExit()
//     {
//         TooltipSystem.Hide();
//     }

// }

// using UnityEngine;
// using UnityEngine.EventSystems;

// public class TooltipTrigger : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
// {
//     public static LTDescr delay;
//     public string header;
//     [Multiline()]
//     public string content;


//     public void OnPointerEnter(PointerEventData eventData)
//     {
//         delay = LeanTween.delayedCall(0.5f, () => {
//         TooltipSystem.Show(content, header);
//         });
//     }

//     public void OnPointerExit(PointerEventData eventData)
//     {
//         LeanTween.cancel(delay.uniqueId);
//         TooltipSystem.Hide();
        
//     }

//     public void OnMouseEnter()
//     {
//         delay = LeanTween.delayedCall(0.5f, () => {
//         TooltipSystem.Show(content, header);
//         });
//     }

//     public void OnMouseExit()
//     {
//         LeanTween.cancel(delay.uniqueId);
//         TooltipSystem.Hide();
//     }

// }


using UnityEngine;
using UnityEngine.EventSystems;

public class TooltipTrigger : MonoBehaviour
{
    public static LTDescr delay;
    public string header;
    [Multiline()]
    public string content;


    public void OnMouseEnter()
    {
        delay = LeanTween.delayedCall(0.5f, () => {
        TooltipSystem.Show(content, header);
        });
    }

    public void OnMouseExit()
    {
        LeanTween.cancel(delay.uniqueId);
        TooltipSystem.Hide();
    }

}
