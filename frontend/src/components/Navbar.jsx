/**
 * Navbar - Barra de navegación principal
 * Estilo Twitter/X dark mode
 */

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  FiHome,
  FiUser,
  FiUsers,
  FiMessageSquare,
  FiLogOut,
  FiTrendingUp,
  FiActivity,
} from "react-icons/fi";
import { logout } from "../features/auth/authSlice";

const Navbar = () => {
  const { currentUser, isAuthenticated } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // console.log(currentUser);
  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  if (!isAuthenticated) return null;

  return (
    <nav
      className="fixed left-0 top-0 h-screen w-64 bg-dark-bg border-r border-dark-border flex flex-col"
      data-testid="navbar"
    >
      {/* Logo */}
      <div className="p-4">
        <Link to="/feed" className="flex items-center space-x-2">
          <div
            className="w-10 h-10 bg-accent rounded-full flex items-center justify-center mr-3 
                cursor-pointer 
                hover:bg-gray-500 
                hover:scale-110 
                transition-all duration-300"
          >
            <span className="text-white font-bold text-xl">
              {currentUser.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xl font-bold ">The Social Service</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-2 py-4 space-y-2">
        <NavItem icon={<FiHome />} text="Feed" to="/feed" testId="nav-feed" />
        <NavItem
          icon={<FiTrendingUp />}
          text="Trending"
          to="/trending"
          testId="nav-trending"
        />
        <NavItem
          icon={<FiUsers />}
          text="Descubrir"
          to="/discover"
          testId="nav-discover"
        />
        <NavItem
          icon={<FiMessageSquare />}
          text="Mensajes"
          to="/messages"
          testId="nav-messages"
        />
        <NavItem
          icon={<FiActivity />}
          text="Observability"
          to="/observability"
          testId="nav-observability"
        />
        <NavItem
          icon={<FiUser />}
          text="Perfil"
          to={`/profile/${currentUser?.username}`}
          testId="nav-profile"
        />
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-dark-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-accent-dark rounded-full flex items-center justify-center">
              <span className="text-white font-bold">
                {currentUser?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm" data-testid="nav-username">
                {currentUser?.username}
              </p>
              <p className="text-text-secondary text-xs">
                @{currentUser?.username}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-dark-hover rounded-full transition-colors"
            title="Cerrar sesión"
            data-testid="logout-button"
          >
            <FiLogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
};

const NavItem = ({ icon, text, to, testId }) => {
  return (
    <Link
      to={to}
      className="flex items-center space-x-4 px-4 py-3 rounded-full hover:bg-dark-hover transition-colors group"
      data-testid={testId}
    >
      <span className="text-2xl group-hover:text-accent transition-colors">
        {icon}
      </span>
      <span className="text-lg font-medium">{text}</span>
    </Link>
  );
};

export default Navbar;
