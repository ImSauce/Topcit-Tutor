using UnityEngine;
using UnityEngine.InputSystem; //enable the new InputAction system
public class PlayerController : MonoBehaviour
{
    [SerializeField] private float speed = 5.0f; //speed at which the vehicle moves
    [SerializeField] private float turnSpeed; //speed at which the vehicle turns
    [SerializeField] private InputAction moveAction; //create an input action to take the input from the player
    [SerializeField] private Vector2 moveInput; //take the input from the player

    // void OnEnable()
    // {
    //     moveAction.Enable();
    // }
    void Start()
    {
        //enable the input action
        moveAction.Enable();
    }

    void Update()
    {
        //get the input from the player  dsfsdf
        moveInput = moveAction.ReadValue<Vector2>();
        //move the vehicle forward and backward
        transform.Translate(Vector3.forward * Time.deltaTime * speed * moveInput.y);
        //rotate the vehicle 
        transform.Rotate(Vector3.up * Time.deltaTime * turnSpeed * moveInput.x);
    }
}
