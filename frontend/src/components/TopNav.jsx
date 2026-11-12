// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~85%
// AI-Assisted Areas: Designed and implemented the shared top navigation bar that
//   replaces the seven hand-rolled, per-page nav bars (logo, links with active
//   state + unread badge, notification bell, and the user dropdown menu). Owns the
//   menu open/close state and outside-click handling that every page used to
//   duplicate.
// Human Contributions: Directed the refactor (single component + single
//   stylesheet), the prop contract (each page maps link labels to its own
//   navigation action), and verification across patient + provider surfaces.
// Notes: Validated via `npm run build`, eslint, and manual click-through.
import { useState, useRef, useEffect } from "react";
import { ChevronDown, User, LogOut, Settings } from "lucide-react";
import NotificationBell from "./NotificationBell";
import "./TopNav.css";

/**
 * Shared application top navigation bar.
 *
 * @param links       Array of "Label" strings or { label, badge } objects.
 * @param activeKey   The label of the currently-active link.
 * @param onSelect    (label) => void — called when a link is clicked. The parent
 *                    decides what each label does (page route vs. internal view).
 * @param onLogoClick () => void — clicking the HealthNest logo (→ home/dashboard).
 * @param userName    Display name shown in the user chip.
 * @param userRole    Secondary line under the name (e.g. "Patient" or specialty).
 * @param userInitials Optional initials string; renders an initials avatar instead
 *                    of the default User icon.
 * @param onAccountSettings Optional handler for the "Account Settings" item.
 * @param onSignOut   () => void — sign-out handler (the last menu item).
 * @param showBell    Whether to render the notification bell (default true).
 *
 * The user dropdown is identical on every page: "Account Settings" then
 * "Sign out". (Account-specific actions like biometric enrollment live on the
 * account settings page, not the nav.)
 */
export default function TopNav({
  links = [],
  activeKey = null,
  onSelect,
  onLogoClick,
  userName = "",
  userRole = "",
  userInitials = null,
  onAccountSettings,
  onSignOut,
  showBell = true,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const handleLogo = () => onLogoClick?.();

  return (
    <nav className="topnav">
      <div className="topnav-left">
        <span
          className="topnav-logo"
          role="button"
          tabIndex={0}
          onClick={handleLogo}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && handleLogo()
          }
        >
          <u>HealthNest</u>
        </span>

        {links.map((raw) => {
          const link = typeof raw === "string" ? { label: raw } : raw;
          const isActive = link.label === activeKey;
          return (
            <button
              key={link.label}
              className={`topnav-link${isActive ? " active" : ""}`}
              onClick={() => onSelect?.(link.label)}
            >
              {link.label}
              {link.badge > 0 && (
                <span className="topnav-badge">{link.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="topnav-right">
        {showBell && <NotificationBell />}

        <div className="topnav-user-wrap" ref={menuRef}>
          <button
            type="button"
            className="topnav-user"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="topnav-avatar">
              {userInitials ? userInitials : <User size={16} />}
            </div>
            <div className="topnav-user-info">
              <span className="topnav-user-name">{userName}</span>
              {userRole && <span className="topnav-user-role">{userRole}</span>}
            </div>
            <ChevronDown size={16} />
          </button>

          {menuOpen && (
            <div className="topnav-user-menu" role="menu">
              <button
                type="button"
                className="topnav-user-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onAccountSettings?.();
                }}
                role="menuitem"
              >
                <Settings size={14} />
                Account Settings
              </button>
              <button
                type="button"
                className="topnav-user-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut?.();
                }}
                role="menuitem"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
