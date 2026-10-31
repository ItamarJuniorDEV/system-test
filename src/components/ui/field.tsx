import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
} from "react";

/** Label e ajuda separados: opções de um select não entram no nome acessível. */
export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  const generatedId = useId();
  const controls = Children.toArray(children).filter(isValidElement);
  const child = controls.length === 1 ? controls[0] : null;
  if (!isValidElement<{ id?: string; "aria-describedby"?: string }>(child))
    throw new Error("Field exige um controle de formulário.");
  const id = child.props.id ?? generatedId;
  const describedBy =
    [child.props["aria-describedby"], hint ? `${id}-help` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(child, { id, "aria-describedby": describedBy })}
      {hint && <small id={`${id}-help`}>{hint}</small>}
    </div>
  );
}
