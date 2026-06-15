import React from 'react';

interface MaterialIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * The name of the Google Material Symbol (e.g. "search", "settings", "close", "check")
   */
  name: string;
  /**
   * Optional extra Tailwind classes
   */
  className?: string;
  /**
   * Whether to fill/solidify the icon style (defaults to false / outlined)
   */
  fill?: boolean;
  /**
   * Font weight of the symbol icon (defaults to 400)
   */
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  /**
   * Optical size option (defaults to 24)
   */
  opsz?: 20 | 24 | 40 | 48;
}

/**
 * MaterialIcon - A reusable component to render Google Material Symbols Rounded.
 * Usage:
 * <MaterialIcon name="grade" fill={true} className="text-yellow-400" />
 */
export const MaterialIcon: React.FC<MaterialIconProps> = ({
  name,
  className = "",
  fill = false,
  weight = 400,
  opsz = 24,
  ...props
}) => {
  return (
    <span
      className={`material-symbols-rounded select-none ${className}`}
      style={{
        fontVariationSettings: `"FILL" ${fill ? 1 : 0}, "wght" ${weight}, "GRAD" 0, "opsz" ${opsz}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        lineHeight: 1,
        fontSize: 'inherit', // Respects parent text size automatically (e.g. text-sm, text-xl)
      }}
      {...props}
    >
      {name}
    </span>
  );
};
