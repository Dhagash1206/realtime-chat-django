const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
};

export const HashIcon = ({ className = "h-4 w-4" }) => (
  <svg {...iconProps} className={className}>
    <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
  </svg>
);

export const SendIcon = ({ className = "h-5 w-5" }) => (
  <svg {...iconProps} className={className}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

export const PlusIcon = ({ className = "h-4 w-4" }) => (
  <svg {...iconProps} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const LogoutIcon = ({ className = "h-4 w-4" }) => (
  <svg {...iconProps} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const MenuIcon = ({ className = "h-5 w-5" }) => (
  <svg {...iconProps} className={className}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const UsersIcon = ({ className = "h-5 w-5" }) => (
  <svg {...iconProps} className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const ChatBubbleIcon = ({ className = "h-6 w-6" }) => (
  <svg {...iconProps} className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const UserIcon = ({ className = "h-4 w-4" }) => (
  <svg {...iconProps} className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const LockIcon = ({ className = "h-4 w-4" }) => (
  <svg {...iconProps} className={className}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
