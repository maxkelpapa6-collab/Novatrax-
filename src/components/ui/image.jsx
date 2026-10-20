import * as React from "react"

/**
 * Image simple : `fittingType="fill"` remplit le cadre (recadrage), sinon
 * l'image est contenue dans le cadre. Une image cassée est masquée.
 */
const Image = React.forwardRef(
  ({ src, fittingType = "fill", originWidth, originHeight, focalPointX, focalPointY, quality, onError, className = "", style, ...props }, ref) => {
    const [broken, setBroken] = React.useState(false)
    React.useEffect(() => setBroken(false), [src])
    if (!src || broken) return <span ref={ref} className={className} style={style} aria-hidden="true" />
    const position = focalPointX != null && focalPointY != null ? `${focalPointX}% ${focalPointY}%` : undefined
    return (
      <img
        ref={ref}
        src={src}
        loading="lazy"
        decoding="async"
        width={originWidth}
        height={originHeight}
        className={className}
        style={{ objectFit: fittingType === "fill" ? "cover" : "contain", objectPosition: position, ...style }}
        onError={(e) => {
          setBroken(true)
          onError?.(e)
        }}
        {...props}
      />
    )
  }
)
Image.displayName = "Image"

export { Image }
