using System;

namespace TetraCreations.Attributes
{
    [Flags]
    public enum DirectionsExample 
    { 
        None = 0,
        North = 1,
        East = 2,
        West = 4,
        South = 8
    }
}
