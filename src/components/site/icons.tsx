import type { ComponentProps, ReactElement } from "react";

type IconProps = Omit<ComponentProps<"svg">, "children">;

/** The site's own glyphs: 20px grid, 1.5px round strokes, no icon library. */
function Icon({ className, ...props }: IconProps & { children: ReactElement }): ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? "size-4"}
      {...props}
    />
  );
}

export function CopyIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <>
        <rect x="7" y="7" width="9.5" height="9.5" rx="1.5" />
        <path d="M13 7V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v6.5A1.5 1.5 0 0 0 5 13h2" />
      </>
    </Icon>
  );
}

export function CheckIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M4 10.5l4 4 8-9" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <>
        <circle cx="9" cy="9" r="5.5" />
        <path d="M13.2 13.2 17 17" />
      </>
    </Icon>
  );
}

export function SunIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <>
        <circle cx="10" cy="10" r="3.5" />
        <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
      </>
    </Icon>
  );
}

export function MoonIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M16.5 12.2A6.75 6.75 0 0 1 7.8 3.5a6.75 6.75 0 1 0 8.7 8.7Z" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <path d="M5 7.5l5 5 5-5" />
    </Icon>
  );
}

function BrandIcon({
  className,
  children,
  ...props
}: IconProps & { children: ReactElement }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className ?? "size-4"}
      {...props}
    >
      {children}
    </svg>
  );
}

export function MarkdownIcon(props: IconProps): ReactElement {
  return (
    <Icon {...props}>
      <>
        <path d="M5.5 2.5h6l4 4v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" />
        <path d="M11.5 2.5v4h4" />
        <path d="M7 14.5v-4l2 2.2 2-2.2v4" />
      </>
    </Icon>
  );
}

export function AnthropicIcon(props: IconProps): ReactElement {
  return (
    <BrandIcon {...props}>
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </BrandIcon>
  );
}

export function OpenAiIcon(props: IconProps): ReactElement {
  return (
    <BrandIcon {...props}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </BrandIcon>
  );
}

export function GitHubIcon({ className, ...props }: IconProps): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className ?? "size-4"}
      {...props}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
