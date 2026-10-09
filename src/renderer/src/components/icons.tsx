import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Crosshair: the app mark. */
export const MarkIcon = (props: IconProps): React.JSX.Element => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="5.25" />
    <path d="M8 1v3.5M8 11.5V15M1 8h3.5M11.5 8H15" />
    <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
)

export const ChevronIcon = (props: IconProps): React.JSX.Element => (
  <Icon {...props}>
    <path d="m6 4 4 4-4 4" />
  </Icon>
)

export const CloseIcon = (props: IconProps): React.JSX.Element => (
  <Icon {...props}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
)

export const SearchIcon = (props: IconProps): React.JSX.Element => (
  <Icon {...props}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="m10.25 10.25 3.25 3.25" />
  </Icon>
)

export const RefreshIcon = (props: IconProps): React.JSX.Element => (
  <Icon {...props}>
    <path d="M13 8a5 5 0 1 1-1.46-3.54" />
    <path d="M13 2.5V5h-2.5" />
  </Icon>
)

export const BoltIcon = (props: IconProps): React.JSX.Element => (
  <Icon {...props}>
    <path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z" />
  </Icon>
)

export const LockIcon = (props: IconProps): React.JSX.Element => (
  <Icon {...props}>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.25" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </Icon>
)

export const FolderIcon = (props: IconProps): React.JSX.Element => (
  <Icon {...props}>
    <path d="M2 4.5c0-.55.45-1 1-1h3l1.5 1.5H13c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1z" />
  </Icon>
)
