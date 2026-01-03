import sys
p='c:/Users/scott.carmichael/Downloads/test/events.js'
with open(p,encoding='utf8') as f:
    lines=f.readlines()

stack=[]
pairs={'{':'}','(':')','[':']'}
openers=set(pairs.keys())
closers=set(pairs.values())
for i,l in enumerate(lines,1):
    for j,ch in enumerate(l,1):
        if ch in openers:
            stack.append((ch,i,j))
        elif ch in closers:
            if not stack:
                print('Unmatched closer',ch,'at',i,j); sys.exit(0)
            last,li,lj = stack.pop()
            if pairs[last]!=ch:
                print('Mismatched pair: expected',pairs[last],'but got',ch,'at',i,j,'(opened at',li,lj,')'); sys.exit(0)
if stack:
    print('Unclosed opener at',stack[-1][0],'opened at line',stack[-1][1], 'col',stack[-1][2])
else:
    print('All pairs balanced')