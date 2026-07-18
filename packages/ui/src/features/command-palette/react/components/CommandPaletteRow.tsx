import type { CommandPaletteResult } from '../../types.js';

export interface CommandPaletteRowProps {
  result: CommandPaletteResult;
  index: number;
  active: boolean;
  onHover: (index: number) => void;
  onSelect: (result: CommandPaletteResult) => void;
}

export function CommandPaletteRow({ result, index, active, onHover, onSelect }: CommandPaletteRowProps) {
  const { item } = result;
  return (
    <div
      data-idx={index}
      role="option"
      aria-selected={active}
      className={`jini-command-palette-row${active ? ' jini-command-palette-row--active' : ''}`}
      onMouseEnter={() => onHover(index)}
      onClick={() => onSelect(result)}
    >
      <span className="jini-command-palette-row__name" title={item.title ?? item.name}>
        {item.name}
      </span>
      {item.path ? <span className="jini-command-palette-row__path">{item.path}</span> : null}
      <span className="jini-command-palette-row__kind">{item.kind.toUpperCase()}</span>
    </div>
  );
}
