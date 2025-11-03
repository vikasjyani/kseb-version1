

import React from 'react';
import Home from '../views/Home';
import CreateProject from "../views/Projects/CreateProject";
import LoadProject from "../views/Projects/LoadProject";
import DemandProjection from "../views/Demand Forecasting/DemandProjection";
import { DemandVisualization } from "../views/Demand Forecasting/DemandVisualization";
import AnalyzeProfiles from '../views/Load Profiles/AnalyzeProfiles';
import GenerateProfiles from "../views/Load Profiles/GenerateProfiles";
import ModelConfig from "../views/PyPSA Suite/ModelConfig";
import ViewResults from "../views/PyPSA Suite/ViewResults";
import Settings from './Settings';
import OtherTools from './OtherTools'; 

// Helper component to wrap each page
const Page = ({ isSelected, children }) => {
    return (
        <div style={{ display: isSelected ? 'block' : 'none' }} className="h-full w-full">
            {children}
        </div>
    );
};

const MainContent = ({ selected, setSelected, activeProject, setActiveProject, createProjectRenderKey, loadProjectRenderKey }) => {

    return (
        <div className="w-full h-full">
            <Page isSelected={selected === 'Home'}>
                <Home setSelected={setSelected} activeProject={activeProject} setActiveProject={setActiveProject} />
            </Page>
            <Page isSelected={selected === 'Create Project'}>
                <CreateProject key={createProjectRenderKey} setSelected={setSelected} setActiveProject={setActiveProject} />
            </Page>
            <Page isSelected={selected === 'Load Project'}>
                <LoadProject key={loadProjectRenderKey} setSelected={setSelected} activeProject={activeProject} setActiveProject={setActiveProject} />
            </Page>

            <Page isSelected={selected === 'Demand Projection'}>
                <DemandProjection setSelected={setSelected} activeProject={activeProject} />
            </Page>

            <Page isSelected={selected === 'Demand Visualization'}>
                <DemandVisualization setSelected={setSelected} activeProject={activeProject} />
            </Page>

            <Page isSelected={selected === 'Generate Profiles'}>
                <GenerateProfiles activeProject={activeProject} />
            </Page>
            <Page isSelected={selected === 'Analyze Profiles'}>
                <AnalyzeProfiles activeProject={activeProject} setSelected={setSelected} />
            </Page>
            <Page isSelected={selected === 'Model Config'}>
                <ModelConfig activeProject={activeProject} />
            </Page>
            <Page isSelected={selected === 'View Results'}>
                <ViewResults activeProject={activeProject} />
            </Page>
            
            
            <Page isSelected={selected === 'Settings'}>
                <Settings activeProject={activeProject} />
            </Page>
            
            <Page isSelected={selected === 'Other Tools'}>
                <OtherTools />
            </Page>

            <Page isSelected={![
                'Home', 'Create Project', 'Load Project', 'Demand Projection',
                'Demand Visualization', 'Generate Profiles', 'Analyze Profiles',
                'Model Config', 'View Results', 'Settings', 'Other Tools'
            ].includes(selected)}>
                <div className="text-gray-500 text-lg flex items-center justify-center h-full">
                    Please select an option from the sidebar.
                </div>
            </Page>
        </div>
    );
};

export default MainContent;