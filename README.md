## Custom assembly preprocessor for AVR devices (ATMega328P and similar)

```
  * 
  *  Usage:
  *    node index.js -i <InputFileName> -o <OutputFileName>
  *
```
---
```
  Supported custom instructions are:

  > Direct data movement:
    (Rd|k|MEM) -> (Rd|MEM)

  > Data and register direct operations:
    (Rd|k|MEM) <operator> (Rd|k|MEM) -> (Rd|MEM)

  > Direct conditional expressions:
    if (Rd|k|MEM) <operator> (Rd|k|MEM) goto ($LABEL) 

```

---
#### Warning:

This script is a work-in-progress, and prone to be a little inefficient.

---

### Usage in ASM code:

> Simply precede the custom expression with "$", then use the script to parse
> the custom expressions and expand them into actual ASM instructions.
---
#### Example: 
```asm
_sample_routine:
    ; Consider R20 contains some user input
    ; R20 = user input
    $ 0x12 -> mem[0x100]      ; Moves the literal value 0x12 to memory at location 0x100
    $ 0x0F -> R16             ; Moves the literal value 0x0F to register R16
    $ R16 -> mem[0x150]       ; Moves the data in register R16 to memory at location 0x150
    $ R16 + mem[0x100] -> R16 ; Sums data in memory at location 0x100 and the register R16 and moves the result back to R16
    $ if R16 > R20 goto _end  ; Ends the program according to a specific condition
```
#### Full Script Example:
```asm
;  
;  Example script, introducing a variable delay:
;  Custom instructions are preceded by a "$"
;         
  variable_delay:                                                        
    _delay_10ms__init:                                                               
        push R24                                                    
        push R25                                                                     
        $ 0x3E -> R25   ; Direct data movement of the literal value 0x36 to the register R25                                        
        $ 0x9C -> R24   ; Direct data movement of the literal value 0x9C to the register R24                                 
        _delay_10ms__loop:                                                           
            $ R25 - 1 -> R25  ; Direct operation with attribution
            sbci R24, 0                                                              
            $ if R24 != 0 goto _delay_10ms__loop  ; Custom conditional expression
        pop R25                                                                      
        pop R24                                                                      
    $ R16 - 1 -> R16  ; Direct operation with attribution
    $ if R16 != 0 goto _delay_10ms__init  ; Custom conditional expression                                       
    ret                                                                              
```

#### After preprocessing:
```asm
variable_delay:
    _delay_10ms__init:
        push R24
        push R25
        ldi R25, 0x3E
        ldi R24, 0x9C
        _delay_10ms__loop:
            push r24
            push r25
            mov r24, R25
            ldi r25, 1
            sub r24, r25
            mov R25, r24
            pop r24
            pop r25
            sbci R24, 0
            push r24
            mov r24, R24
            push r25
            ldi r25, 0
            pop r25
            pop r24
        pop R25
        pop R24
    push r24
    push r25
    mov r24, R16
    ldi r25, 1
    sub r24, r25
    mov R16, r24
    pop r24
    pop r25
    push r24
    mov r24, R16
    push r25
    ldi r25, 0
    pop r25
    pop r24
    ret                                                       
```
