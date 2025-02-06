class Token {
    constructor (value) {
        this.value = value;
        this.type = Token.infer(value);
        // Special case to take address from memory token
        if (this.type === 'address') this.value = this.value.slice(4, -1);
    }

    static infer (string) {
        const IsRegister = s => /^r[0-9]|r[0-2][0-9]|r3[0-1]$/i.test(s);
        const IsImmediate = s => /^0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+$/i.test(s);
        const IsAddress = s => /^mem\[(?:0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)\]$/i.test(s);
        const IsComparator = s => /^\>\=|\=\<|\>|\<|\<\=|\=\=|\!\=$/i.test(s);
        const IsOperator = s => /^\+|\-|\*|\&|\||\/|\^|\!$/i.test(s);
        const IsLabel = s => /^[0-9A-Z_\-\$\.]{1,16}$/i.test(s);
        return (
            IsRegister(string) ? 'register' :
            IsAddress(string) ? 'address' :
            IsComparator(string) ? 'comparator' :
            IsOperator(string) ? 'operator' :
            IsImmediate(string) ? 'immediate' : 
            IsLabel(string) ? 'label' : 'empty'
        );
    }
}

class Sentence {
    // op1:(Rd|k|MEM) -> dest:(Rd|MEM) [comment:(; ...)]
    static REG_UNARY = /^(?<blank>[ \t]{0,})\$[ \t]{0,}(?<op1>(?:r[0-9]|r[0-2][0-9]|r3[0-1]|0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)|mem\[(?:0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)\])[ \t]{0,}->[ \t]{0,}(?<dest>r[0-9]|r[0-2][0-9]?|r3[0-1]|mem\[(?:0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0[0-8]+|[0-9]+)\])[ \t]{0,}(?<comment>;.{0,})?\r?$/i;
    // op1:(Rd|k|MEM) <operator> op2:(Rd|k|MEM) -> dest:(Rd|MEM) [comment:(; ...)]
    static REG_BINARY = /^(?<blank>[ \t]{0,})\$[ \t]{0,}(?<op1>(?:r[0-9]|r[0-2][0-9]|r3[0-1]|0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)|mem\[(?:0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)\])[ \t]{0,}(?<operator>[\+\-\*\&\|\/\^\!])[ \t]{0,}(?<op2>(?:r[0-9]|r[0-2][0-9]|r3[0-1]|0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)|mem\[(?:0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)\])[ \t]{0,}->[ \t]{0,}(?<dest>r[0-9]|r[0-2][0-9]?|r3[0-1]|mem\[(?:0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0[0-8]+|[0-9]+)\])[ \t]{0,}(?<comment>;.{0,})?\r?$/i;
    // if op1:(Rd|k|MEM) <operator> op2:(Rd|k|MEM) action:(skip|do) dest:(k) [comment:(; ...)]
    static REG_CONDITIONAL = /^(?<blank>[ \t]{0,})\$[ \t]{0,}if[ \t]{0,}(?<op1>(?:r[0-9]|r[0-2][0-9]|r3[0-1]|0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)|mem\[(?:0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)\])[ \t]{0,}(?<operator>\>\=|\=\<|\>|\<|\<\=|\=\=|\!\=)[ \t]{0,}(?<op2>(?:r[0-9]|r[0-2][0-9]|r3[0-1]|0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)|mem\[(?:0x[0-9A-F]+|\$[0-9A-F]+|[0-9A-F]+h|0b[01]+|0[0-8]+|[0-9]+)\])[ \t]{0,}(?<action>goto)[ \t]{0,}(?<dest>[0-9A-Z_\-\$\.]{1,64})[ \t]{0,}(?<comment>;.{0,})?\r?$/i;
    // comment:(; ...)
    static REG_COMMENT = /^(?<blank>[ \t]{0,})(?<comment>;.+)\r?$/i;
    // native:(...)
    static REG_NATIVE = /^(?<blank>[ \t]{0,})(?<native>.+)\r?$/i;
    // empty
    static REG_EMPTY = /^(?<empty>[ \t]{0,})\r?$/i;

    constructor (string) {
        this.input = string;
        this.type = '';
        this.match;
        this.native = false;

        this.match = string.match(Sentence.REG_UNARY)?.groups;
        if (this.match) return (this.type = 'unary', this);

        this.match = string.match(Sentence.REG_BINARY)?.groups;
        if (this.match) return (this.type = 'binary', this);

        this.match = string.match(Sentence.REG_CONDITIONAL)?.groups;
        if (this.match) return (this.type = 'conditional', this);
        

        this.native = true;
        // All the three are Native items (comments, blanks, and ASM instructions)
        this.match = string.match(Sentence.REG_COMMENT)?.groups;
        if (this.match) return (this.type = 'comment', this);

        this.match = string.match(Sentence.REG_NATIVE)?.groups;
        if (this.match) return (this.type = 'native', this);

        this.match = { blank: '' };
        if (this.match) return (this.type = 'blank', this);
    }

    // Just to supress constructor usage
    // and add proper tokens
    static from (string) { 
        const sent = new Sentence(string.trimEnd());
        for (let unit in sent.match)
            sent.match[unit] = new Token(sent.match[unit]);
        if (!sent.native) sent.input = sent.input.toLowerCase();
        return sent;
    };
}


function preprocess (InFile, OutFile) {
    const string = fs.readFileSync(InFile, 'utf-8');
    let sentences = string.split('\n').map(Sentence.from);
    let collector = [];

    for (let sentence of sentences) {
        let subcollector = [];
        let match = sentence.match;
        let blank = sentence.match.blank.value;

        if (sentence.type === 'native' || sentence.type === 'blank' || sentence.type === 'comment') {
            collector.push(sentence.input);
            continue;
        }

        /*
            For unary data movement:
                op1:(Rd|k|MEM) -> dest:(Rd|MEM) [comment:(; ...)]
        */
        if (sentence.type === 'unary') {

            // op1:(Rd) -> dest:(Rd)
            if (match.op1.type === 'register' && match.dest.type === 'register')
                subcollector.push(`mov ${match.dest.value}, ${match.op1.value}`)
            ;

            // op1:(k) -> dest:(Rd)
            if (match.op1.type === 'immediate' && match.dest.type === 'register') 
                subcollector.push(`ldi ${match.dest.value}, ${match.op1.value}`)
            ;

            // op1:(MEM) -> dest:(Rd)
            if (match.op1.type === 'address' && match.dest.type === 'register') 
                subcollector.push(
                    `push r26`,
                    `push r27`,
                    `ldi r27, high(${match.op1.value})`,
                    `ldi r26, low(${match.op1.value})`,
                    `ld ${match.dest.value}, X`,
                    `pop r27`,
                    `pop r26`
                )
            ;

            // op1:(Rd) -> dest:(MEM)
            if (match.op1.type === 'register' && match.dest.type === 'address')
                subcollector.push(
                    `push r26`,
                    `push r27`,
                    `ldi r27, high(${match.dest.value})`,
                    `ldi r26, low(${match.dest.value})`,
                    `st X, ${match.op1.value}`,
                    `pop r27`,
                    `pop r26`
                )
            ;

            // op1:(k) -> dest:(MEM)
            if (match.op1.type === 'immediate' && match.dest.type === 'address') 
                subcollector.push(
                    `push r26`,
                    `push r27`,
                    `push r25`,
                    `ldi r25, ${match.op1.value}`,
                    `ldi r27, high(${match.dest.value})`,
                    `ldi r26, low(${match.dest.value})`,
                    `st X, r25`,
                    `pop r25`,
                    `pop r27`,
                    `pop r26`
                )
            ;
                
            // op1:(MEM) -> dest:(MEM)
            if (match.op1.type === 'address' && match.dest.type === 'address') 
                subcollector.push(
                    `push r26`,
                    `push r27`,
                    `push r25`,
                    `ldi r27, high(${match.op1.value})`,
                    `ldi r26, low(${match.op1.value})`,
                    `ld r25, X`,
                    `ldi r27, high(${match.dest.value})`,
                    `ldi r26, low(${match.dest.value})`,
                    `st X, r25`,
                    `pop r25`,
                    `pop r27`,
                    `pop r26`
                )
            ;
        }

        /*
            For binary data operations:
                op1:(Rd|k|MEM) <operator> op2:(Rd|k|MEM) -> dest:(Rd|MEM) [comment:(; ...)]
        */
        else if (sentence.type === 'binary') {
            // Independent of the parameter types for op1 and op2, 
            // we use R24 and R25 to hold operands, to simplify construction
            // of operation blocks
            let operatorBlock;
            if (match.operator.value === '+') operatorBlock = ['add r24, r25'];
            if (match.operator.value === '-') operatorBlock = ['sub r24, r25'];
            if (match.operator.value === '*') operatorBlock = ['mul r24, r25'];
            if (match.operator.value === '&') operatorBlock = ['and r24, r25'];
            if (match.operator.value === '|') operatorBlock = ['or  r24, r25'];
            if (match.operator.value === '^') operatorBlock = ['eor r24, r25'];
            if (match.operator.value === '!') operatorBlock = ['neg r24, r25'];

            let destBlock;
            if (match.dest.type === 'register') destBlock = [`mov ${match.dest.value}, r24`];
            else destBlock = [ 
                'push r26',
                'push r27',
                `ldi r27, high(${match.dest.value})`,
                `ldi r26, low(${match.dest.value})`,
                'st X, r24',
                'pop r27',
                'pop r26'
            ];

            let pushr24r25 = [ 'push r24', 'push r25' ];
            let popr24r25  = [ 'pop r24' , 'pop r25'  ];
            let pushr26r27 = [ 'push r26', 'push r27' ];
            let popr26r27  = [ 'pop r26' , 'pop r27'  ];

            // op1:(Rd) <operator> op2:(Rd) -> dest:(Rd|MEM) [comment:(; ...)]
            if (match.op1.type === 'register' && match.op2.type === 'register')
                subcollector.push(
                    ...pushr24r25,
                    `mov r24, ${match.op1.value}`,
                    `mov r25, ${match.op2.value}`,
                    ...operatorBlock,
                    ...destBlock,
                    ...popr24r25
                );

            // op1:(k) <operator> op2:(Rd) -> dest:(Rd|MEM) [comment:(; ...)]
            if (match.op1.type === 'immediate' && match.op2.type === 'register')
                subcollector.push(
                    ...pushr24r25,
                    `ldi r24, ${match.op1.value}`,
                    `mov r25, ${match.op2.value}`,
                    ...operatorBlock,
                    ...destBlock,
                    ...popr24r25
                );

            // op1:(MEM) <operator> op2:(Rd) -> dest:(Rd|MEM) [comment:(; ...)]
            if (match.op1.type === 'address' && match.op2.type === 'register')
                subcollector.push(
                    ...pushr24r25,
                    `mov r25, ${match.op2.value}`,
                    ...pushr26r27,
                    `ldi r27, high(${match.op1.value})`,
                    `ldi r26, low(${match.op1.value})`,
                    `ld r24, X`,
                    ...popr26r27,
                    ...operatorBlock,
                    ...destBlock,
                    ...popr24r25
                );

            // op1:(Rd) <operator> op2:(k) -> dest:(Rd|MEM) [comment:(; ...)]
            if (match.op1.type === 'register' && match.op2.type === 'immediate')
                subcollector.push(
                    ...pushr24r25,
                    `mov r24, ${match.op1.value}`,
                    `ldi r25, ${match.op2.value}`,
                    ...operatorBlock,
                    ...destBlock,
                    ...popr24r25
                );

            // op1:(k) <operator> op2:(k) -> dest:(Rd|MEM) [comment:(; ...)]
            if (match.op1.type === 'immediate' && match.op2.type === 'immediate')
                subcollector.push(
                    ...pushr24r25,
                    `ldi r24, ${match.op1.value}`,
                    `ldi r25, ${match.op2.value}`,
                    ...operatorBlock,
                    ...destBlock,
                    ...popr24r25
                );

            // op1:(MEM) <operator> op2:(k) -> dest:(Rd|MEM) [comment:(; ...)]
            if (match.op1.type === 'address' && match.op2.type === 'immediate')
                subcollector.push(
                    ...pushr24r25,
                    `ldi r25, ${match.op2.value}`,
                    ...pushr26r27,
                    `ldi r27, high(${match.op1.value})`,
                    `ldi r26, low(${match.op1.value})`,
                    `ld r24, X`,
                    ...popr26r27,
                    ...operatorBlock,
                    ...destBlock,
                    ...popr24r25
                );

            // op1:(Rd) <operator> op2:(MEM) -> dest:(Rd|MEM) [comment:(; ...)]
            if (match.op1.type === 'register' && match.op2.type === 'address')
                subcollector.push(
                    ...pushr24r25,
                    `mov r24, ${match.op1.value}`,
                    ...pushr26r27,
                    `ldi r27, high(${match.op2.value})`,
                    `ldi r26, low(${match.op2.value})`,
                    `ld r25, X`,
                    ...popr26r27,
                    ...operatorBlock,
                    ...destBlock,
                    ...popr24r25
                );

            // op1:(k) <operator> op2:(MEM) -> dest:(Rd|MEM) [comment:(; ...)]
            if (match.op1.type === 'immediate' && match.op2.type === 'address')
                subcollector.push(
                    ...pushr24r25,
                    `ldi r24, ${match.op1.value}`,
                    ...pushr26r27,
                    `ldi r27, high(${match.op2.value})`,
                    `ldi r26, low(${match.op2.value})`,
                    `ld r25, X`,
                    ...popr26r27,
                    ...operatorBlock,
                    ...destBlock,
                    ...popr24r25
                );

            // op1:(MEM) <operator> op2:(MEM) -> dest:(Rd|MEM) [comment:(; ...)]
            if (match.op1.type === 'address' && match.op2.type === 'address')
                subcollector.push(
                    ...pushr24r25,
                    ...pushr26r27,
                    `ldi r27, high(${match.op1.value})`,
                    `ldi r26, low(${match.op1.value})`,
                    `ld r24, X`,
                    ...popr26r27,
                    ...pushr26r27,
                    `ldi r27, high(${match.op2.value})`,
                    `ldi r26, low(${match.op2.value})`,
                    `ld r25, X`,
                    ...popr26r27,
                    ...operatorBlock,
                    ...destBlock,
                    ...popr24r25
                );
        }

        /*
            For conditional data sentences:
                if op1:(Rd|k|MEM) <operator> op2:(Rd|k|MEM) goto dest:($LABEL) [comment:(; ...)]
        */
        else if (sentence.type === 'conditional') {
            let op1Block = ['push r24'];
            let op1BlockEnd = ['pop r24'];
            if (match.op1.type === 'register')
                op1Block.push(`mov r24, ${match.op1.value}`);

            if (match.op1.type === 'immediate') 
                op1Block.push(`ldi r24, ${match.op1.value}`);

            if (match.op1.type === 'address') 
                op1Block.push(
                    'push r26', 
                    'push r27', 
                    `ldi r27, high(${match.op1.value})`, 
                    `ldi r26, low(${match.op1.value})`,
                    'pop r27',
                    'pop r26',
                    `ld r24, X`,
                );


            let op2Block = ['push r25'];
            let op2BlockEnd = ['pop r25'];
            if (match.op2.type === 'register')
                op2Block.push(`mov r25, ${match.op2.value}`);

            if (match.op2.type === 'immediate') 
                op2Block.push(`ldi r25, ${match.op2.value}`);
            
            if (match.op2.type === 'address') 
                op2Block.push( 
                    'push r26', 
                    'push r27', 
                    `ldi r27, high(${match.op2.value})`, 
                    `ldi r26, low(${match.op2.value})`,
                    `ld r25, X`,
                    'pop r27',
                    'pop r26',
                );

            let comparatorBlock = []; 
            let branchBlock = [];
            if (match.operator.value === '==') 
                (comparatorBlock = ['cp r24, r25'],    branchBlock = [`breq ${match.dest.value}`]);
            if (match.operator.value === '!==')
                (comparatorBlock = ['cp r24, r25'],    branchBlock = [`brne ${match.dest.value}`]);
            if (match.operator.value === '>=')
                (comparatorBlock = ['cp r24, r25'],    branchBlock = [`brcc ${match.dest.value}`]);
            if (match.operator.value === '=<' || match.operator.value === '<=')
                (comparatorBlock = ['cp r25, r24'],    branchBlock = [`brcc ${match.dest.value}`]);
            if (match.operator.value === '>')
                (comparatorBlock = ['cp r25, r24'],    branchBlock = [`brcs ${match.dest.value}`]);
            if (match.operator.value === '<')
                (comparatorBlock = ['cp r24, r25'],    branchBlock = [`brcs ${match.dest.value}`]);


            subcollector.push(
                ...op1Block,
                ...op2Block,
                ...comparatorBlock,
                ...op2BlockEnd,
                ...op1BlockEnd,
                ...branchBlock,
            );
        }

        subcollector = subcollector.map(v => blank + v);
        collector.push(...subcollector);
    }

    
    (function saveresult () {
        const output = collector.join('\n');
        fs.writeFileSync(OutFile, output);
    })();

    (function logstats () {
        const stats = {};
            stats.infile = InFile.replaceAll('\\', '/').split('/').slice(-1)[0];
            stats.outfile = OutFile.replaceAll('\\', '/').split('/').slice(-1)[0];
            stats.instructionsIn = (sentences.filter(v => v.type !== 'blank' && v.type !== 'comment').length).toString();
            stats.instructionsOut = (collector.length - (sentences.length - stats.instructionsIn)).toString();
            stats.transpiled = ('('+sentences.filter(v => !v.native).length +')');
            stats.transpiled2 = ('('+((collector.length - (sentences.length - stats.instructionsIn)) - sentences.filter(v => v.type === 'native').length) + ')').toString();
            stats.native = ('('+sentences.filter(v => v.type === 'native').length +')');
            stats.infilesize = (fs.statSync(InFile).size).toString();
            stats.outfilesize = (fs.statSync(OutFile).size).toString();
            stats.infilesizekb = (fs.statSync(InFile).size / 1024).toFixed(2);
            stats.outfilesizekb = (fs.statSync(OutFile).size / 1024).toFixed(2);

            let longest = Math.max(...Object.values(stats).map(v => v.length));

            stats.infile = stats.infile.padEnd(longest, ' ').substring(0, longest);
            stats.outfile = stats.outfile.padEnd(longest, ' ').substring(0, longest);
            stats.instructionsIn = stats.instructionsIn.padEnd(longest, ' ').substring(0, longest);
            stats.instructionsOut = stats.instructionsOut.padEnd(longest, ' ').substring(0, longest);
            stats.transpiled = stats.transpiled.padEnd(longest, ' ').substring(0, longest);
            stats.native = stats.native.padEnd(longest, ' ').substring(0, longest);
            stats.transpiled2 = stats.transpiled2.padEnd(longest, ' ').substring(0, longest);
            stats.infilesize = stats.infilesize.padEnd(longest, ' ').substring(0, longest);
            stats.outfilesize = stats.outfilesize.padEnd(longest, ' ').substring(0, longest);
            stats.infilesizekb = stats.infilesizekb.padEnd(longest, ' ').substring(0, longest);
            stats.outfilesizekb = stats.outfilesizekb.padEnd(longest, ' ').substring(0, longest);
            let hline = '─'.repeat(longest);
            let eline = ' '.repeat(longest);

        console.log(                                                                 
           `                ┌─${hline}─┬─${hline}─┐\n` +  
           `                │ ${stats.infile} │ ${stats.outfile} │\n`          +
           `┌───────────────┼─${hline}─┼─${hline}─┤\n` +
           `│ Instructions  │ ${stats.instructionsIn} │ ${stats.instructionsOut} │\n` +
           `│ (Transpiled)  │ ${stats.transpiled} │ ${stats.transpiled2} │\n` +
           `│ (Native)      │ ${stats.native} │ ${stats.native} │\n` +
           `├───────────────┼─${hline}─┼─${hline}─┤\n` +
           `│ File Size (b) │ ${stats.infilesize} │ ${stats.outfilesize} │\n` +
           `│ (Kb)          │ ${stats.infilesizekb} │ ${stats.outfilesizekb} │\n` +
           `└───────────────┴─${hline}─┴─${hline}─┘\n`
        );
    })();

    return;
}






const fs = require('fs');
const path = require('path');

const HELP_MESSAGE = `
  *
  *  Custom-assembly preprocessor for AVR devices (ATMega328P and similar)
  * 
  *  Usage:
  * 
  *    node preprocessor -i <InputFileName> -o <OutputFileName>
  *
`;

(function () {
    const args = process.argv.slice(2);
    let infile, outfile;

    if (args.length === 0 || args[0] === '-h' || args[0] === '--help')
        return console.log(HELP_MESSAGE);

    if (args[0] === '-i' || args[0] === '--in') infile = args[1];
    else if (args[0] === '-o' || args[0] === '--out') outfile = args[1];
    else return console.log(`Error: Invalid command line option [${args[0]}]`);

    if (args[2] === '-i' || args[2] === '--in') infile = args[3];
    else if (args[2] === '-o' || args[2] === '--out') outfile = args[3];
    else return console.log(`Error: Invalid command line option [${args[2]}]`);

    return preprocess(
        path.resolve(infile), 
        path.resolve(outfile)
    );
})();
