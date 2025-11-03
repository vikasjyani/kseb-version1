

import React, { useState, useEffect, useRef } from "react"; 
import {
    FiHome,
    FiSettings,
    FiChevronsLeft,
    FiChevronsRight,
    FiGrid,
} from "react-icons/fi";
import { GoProject } from "react-icons/go";
import { IoTrendingUpOutline } from "react-icons/io5";
import { LuLoaderCircle } from "react-icons/lu";
import { CiSliderHorizontal } from "react-icons/ci";
import { MdCreateNewFolder } from "react-icons/md";
import { BsUpload } from "react-icons/bs";
import { VscGraph } from "react-icons/vsc";
import { TbActivityHeartbeat } from "react-icons/tb";
import { ChevronDown, BarChart3 } from "lucide-react";

const Sidebar = ({ selected, setSelected, collapsed, setCollapsed }) => {
    const sidebarRef = useRef(null); // Create a ref for the sidebar container

    const getInitialState = (key) => localStorage.getItem(key) === "true";

    const [projectsOpen, setProjectsOpen] = useState(() =>
        getInitialState("projectsOpen")
    );
    const [forecastOpen, setForecastOpen] = useState(() =>
        getInitialState("forecastOpen")
    );
    const [loadProfiles, setLoadProfiles] = useState(() =>
        getInitialState("loadProfiles")
    );
    const [loadPsaSuite, setLoadPsaSuite] = useState(() =>
        getInitialState("loadPsaSuite")
    );

    const [openCollapsedMenu, setOpenCollapsedMenu] = useState(null);

    useEffect(() => {
        if (!collapsed) {
            setOpenCollapsedMenu(null);
        }
    }, [collapsed]);


    useEffect(() => {
        // Only add listener when a collapsed menu is actually open
        if (openCollapsedMenu === null) return;

        const handleClickOutside = (event) => {
            // Check if the click was outside the sidebar container
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setOpenCollapsedMenu(null);
            }
        };

        // Add event listener only when a menu is open
        document.addEventListener("mousedown", handleClickOutside);

        // Cleanup function to remove event listener
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [openCollapsedMenu]); // Re-run when openCollapsedMenu changes

    const menuItems = [
        { name: "Home", icon: <FiHome size={20} /> },
        {
            name: "Projects",
            icon: <GoProject size={20} />,
            state: projectsOpen,
            setter: setProjectsOpen,
            dropdown: [
                { name: "Create Project", icon: <MdCreateNewFolder size={18} /> },
                { name: "Load Project", icon: <BsUpload size={18} /> },
            ],
        },
        {
            name: "Demand Forecasting",
            icon: <IoTrendingUpOutline size={20} />,
            state: forecastOpen,
            setter: setForecastOpen,
            dropdown: [
                { name: "Demand Projection", icon: <VscGraph size={18} /> },
                { name: "Demand Visualization", icon: <TbActivityHeartbeat size={18} /> },
            ],
        },
        {
            name: "Load Profiles",
            icon: <LuLoaderCircle size={20} />,
            state: loadProfiles,
            setter: setLoadProfiles,
            dropdown: [
                { name: "Generate Profiles", icon: <BarChart3 size={18} /> },
                { name: "Analyze Profiles", icon: <TbActivityHeartbeat size={18} /> },
            ],
        },
        {
            name: "PyPSA Suite",
            icon: <CiSliderHorizontal size={20} />,
            state: loadPsaSuite,
            setter: setLoadPsaSuite,
            dropdown: [
                { name: "Model Config", icon: <VscGraph size={18} /> },
                { name: "View Results", icon: <TbActivityHeartbeat size={18} /> },
            ],
        },
    ];
    
    const homeItem = menuItems[0];
    const otherMenuItems = menuItems.slice(1);
    const isHomeActive = selected === homeItem.name;

    return (
        // Attach the ref to the main sidebar container
        <div
            ref={sidebarRef} 
            className={`h-full bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-700/50 ${
                collapsed ? "w-20" : "w-72"
            }`}
        >
            <div className={`flex-1 flex flex-col ${!collapsed ? 'overflow-y-auto' : ''}`}>
                <div className="px-4 pt-4 pb-2">
                    <button
                        onClick={() => {
                            setSelected(homeItem.name);
                            setOpenCollapsedMenu(null);
                        }}
                        className={`flex items-center w-full p-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500 ${
                            isHomeActive
                                ? "bg-indigo-500/10 text-indigo-300"
                                : "hover:bg-slate-700/50 hover:text-white"
                        } ${collapsed ? 'justify-center' : ''}`}
                    >
                        <div className="flex items-center gap-4">
                            {homeItem.icon}
                            {!collapsed && <span className="whitespace-nowrap">{homeItem.name}</span>}
                        </div>
                    </button>
                </div>

                <nav className="px-4 pb-4 space-y-1.5">
                    {otherMenuItems.map(({ name, icon, dropdown, state, setter }) => {
                        const isActive =
                            selected === name ||
                            (dropdown && dropdown.some((item) => item.name === selected));

                        return (
                            <div className="relative" key={name}>
                                <button
                                    onClick={() => {
                                        if (!dropdown) {
                                            setSelected(name);
                                            setOpenCollapsedMenu(null); 
                                            return;
                                        }
                                        if (!collapsed) {
                                            setter((prev) => !prev);
                                        } else {
                                            setOpenCollapsedMenu(openCollapsedMenu === name ? null : name);
                                        }
                                    }}
                                    className={`flex items-center w-full p-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500 ${
                                        isActive
                                            ? "bg-indigo-500/10 text-indigo-300"
                                            : "hover:bg-slate-700/50 hover:text-white"
                                    } ${collapsed ? 'justify-center' : 'justify-between'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        {icon}
                                        {!collapsed && <span className="whitespace-nowrap">{name}</span>}
                                    </div>
                                    {!collapsed && dropdown && (
                                        <ChevronDown
                                            size={16}
                                            className={`transition-transform duration-300 ${state ? "rotate-180" : ""}`}
                                        />
                                    )}
                                </button>

                                {collapsed && dropdown && (
                                    <div className={`absolute left-full top-0 ml-3 w-52 bg-slate-800 text-white rounded-lg shadow-xl border border-slate-700 p-2 space-y-1 z-50 transition-opacity duration-300 ${ openCollapsedMenu === name ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                                        <div className="font-bold text-white px-2 py-1">{name}</div>
                                        {dropdown.map((item) => (
                                            <button key={item.name} onClick={() => { setSelected(item.name); setOpenCollapsedMenu(null); }} className={`flex items-center w-full gap-3 text-sm p-2 rounded-md transition-colors duration-200 active:scale-95 ${ selected === item.name ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"}`}>
                                                {item.icon}
                                                <span className="whitespace-nowrap">{item.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {!collapsed && dropdown && (
                                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${ state ? "max-h-48" : "max-h-0" }`}>
                                        <div className="pt-1 ml-6 pl-3 border-l-2 border-slate-700 space-y-0.5">
                                            {dropdown.map((item) => (
                                                <button key={item.name} onClick={() => setSelected(item.name)} className={`flex items-center w-full gap-3 text-sm p-1.5 rounded-md transition-colors duration-200 active:scale-95 ${ selected === item.name ? "text-indigo-300 font-semibold" : "text-slate-400 hover:text-white" }`}>
                                                    {item.icon}
                                                    <span className="whitespace-nowrap">{item.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </div>

            <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700/50 space-y-1">
                <button onClick={() => { setSelected("Settings"); setOpenCollapsedMenu(null); }} className={`flex items-center w-full p-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500 ${ selected === "Settings" ? "bg-indigo-500/10 text-indigo-300" : "hover:bg-slate-700/50 hover:text-white" } ${collapsed ? 'justify-center' : ''}`}>
                    <div className="flex items-center gap-4">
                        <FiSettings size={20} />
                        {!collapsed && <span className="whitespace-nowrap">Settings</span>}
                    </div>
                </button>
                <button onClick={() => { setSelected("Other Tools"); setOpenCollapsedMenu(null); }} className={`flex items-center w-full p-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500 ${ selected === "Other Tools" ? "bg-indigo-500/10 text-indigo-300" : "hover:bg-slate-700/50 hover:text-white" } ${collapsed ? 'justify-center' : ''}`}>
                    <div className="flex items-center gap-4">
                        <FiGrid size={20} />
                        {!collapsed && <span className="whitespace-nowrap">Other Tools</span>}
                    </div>
                </button>
                <button 
                    onClick={() => setCollapsed(!collapsed)} 
                    className={`flex items-center justify-center w-full p-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-400 hover:bg-slate-700/50 hover:text-white`}
                >
                    <div className="flex items-center gap-4">
                        {collapsed ? <FiChevronsRight size={20} /> : <FiChevronsLeft size={20} />}
                        {!collapsed && <span className="whitespace-nowrap"></span>}
                    </div>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;