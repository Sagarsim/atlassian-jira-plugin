import ForgeUI, { render, AdminPage, Fragment, Text, Button, useState, Form, TextField, Select, Option, SectionMessage, ModalDialog, Tabs, Tab } from '@forge/ui';
import api, { storage, webTrigger } from '@forge/api';
import { getSites, validateAtlasToken } from "./helper";
import { createObjectSchema } from './syncProcess';
const App = () => {
    const [lsToken, setLsToken] = useState("");
    const [configStatus, setConfigStatus] = useState({});
    const [atlasToken, setAtlasToken] = useState("");
    const [atlasEmail, setAtlasEmail] = useState("");
    const [storedSites, setStoredSites] = useState([]);
    const [isOpen, setOpen] = useState(false);
    const [progress, setProgress] = useState(async() => {
        const status = await storage.get("progress")
        return status;
    });
    const [siteList, setSiteList] = useState(async() => {
        const config = await storage.getSecret("lsConfig");
        if(config && config.lsToken){
            const allSites = await getSites(config.lsToken);
            if(allSites.length > 0){
                setAtlasToken(config.atlasToken);
                setAtlasEmail(config.atlasEmail);
                setLsToken(config.lsToken);
                setStoredSites(config.selectedSites);
                setConfigStatus({
                    title: "Success",
                    description: "Configuration done successfully.",
                    appearance: "confirmation"
                })
                return allSites;
            } else {
                return [];                
            }
        } else {
            return [];
        }
    });
    
    const verifyIdentityCode = async (formData) => {
        const allSites = await getSites(formData.lsToken);
        if(allSites.length > 0){
            setSiteList(allSites);
            setStoredSites([]);
            setLsToken(formData.lsToken);
            setConfigStatus({
                title: "Success",
                description: "Lansweeper application connected successfully.",
                appearance: "confirmation"
            });
        } else {
            setSiteList([]);
            setConfigStatus({
                title: "Error",
                description: "Invalid Lansweeper API token. Please enter valid token.",
                appearance: "error"
            });
        }
    }

    const saveConfig = async (formData) => {
        console.log("formdata ==>", formData);
        if(formData.sites.length === 0){
            setConfigStatus({
                title: "Error",
                description: "Please select atleast one site from which the assets will be fetched.",
                appearance: "error"
            })
        } else {
            const workspaceId = await validateAtlasToken(formData.atlasEmail, formData.atlasToken);
            if(workspaceId){
                const finalConfig = {
                    "lsToken": lsToken,
                    "atlasToken": formData.atlasToken,
                    "atlasEmail": formData.atlasEmail,
                    "selectedSites": [...formData.sites],
                    "workspaceId": workspaceId
                }
                storage.setSecret("lsConfig", finalConfig);
                setStoredSites(formData.sites);
                setAtlasEmail(formData.atlasEmail);
                setAtlasToken(formData.atlasToken);
                setConfigStatus({
                    title: "Success",
                    description: "Configuration saved successfully.",
                    appearance: "confirmation"
                })
            } else {
                setConfigStatus({
                    title: "Error",
                    description: "Invalid Atlassian credentials. Please enter valid email ID and API token.",
                    appearance: "error"
                })
            }
        }
    };

    const resetConfig = () => {
        storage.deleteSecret("lsConfig");
        setConfigStatus({})
        setSiteList([]);
        setStoredSites([]);
        setAtlasToken("");
        setAtlasEmail("");
        setLsToken("")
    };

    const actionButtons = [
        <Button text="Reset" onClick={() => setOpen(true)}/>
    ]
    const checkProgress = async () => {
        const status = await storage.get("progress")
        setProgress(status);
    }
    const resetProgress = async () => {
        await storage.set("progress", 0)
        setProgress(0);
    }
    return (
        <Fragment>
            <Tabs>
                <Tab label="Configuration">
                {isOpen && (
                            <ModalDialog header="Are you sure you want to reset the configuration?" closeButtonText='No' onClose={() => setOpen(false)}>
                                <Form
                                    onSubmit={data => {
                                        resetConfig();
                                        setOpen(false);
                                    }}
                                    submitButtonText="Yes"
                                >
                                </Form>
                            </ModalDialog>
                        )}
                        <Form onSubmit={verifyIdentityCode} submitButtonText="Connect to Lansweeper">
                            <TextField type='password' defaultValue={lsToken} isRequired name="lsToken" label="Lansweeper API Token" description="Enter Lansweeper personal application identity code"/>
                        </Form>
                        {(siteList.length > 0) && <Form onSubmit={saveConfig} submitButtonText="Save" actionButtons={actionButtons}>
                                <Select label="Select Sites" isMulti name="sites" description='Select sites from which the assets will be fetched' isRequired>
                                    {siteList.map(st => <Option label={st.name} value={st.id} defaultSelected={storedSites.includes(st.id)}/>)}
                                </Select>
                                <TextField type='email' defaultValue={atlasEmail} isRequired name="atlasEmail" label="Atlassian User Email ID" description="Enter Atlassian user email ID."/>
                                <TextField type='password' defaultValue={atlasToken} isRequired name="atlasToken" label="Atlassian API Token" description="Enter Atlassian API token required to call Insight API."/>
                        </Form>}
                        {configStatus.title && <SectionMessage title={configStatus.title} appearance={configStatus.appearance}>
                            <Text>{configStatus.description}</Text>
                            </SectionMessage>}
                </Tab>
                <Tab label="Sync Assets">
                    <Button onClick={createObjectSchema} text="Create Object Schema" />
                    <Button onClick={checkProgress} text="Check progress" />
                    <Button onClick={resetProgress} text="Reset progress" />
                    <Text>Progress: {progress}</Text>
                </Tab>
            </Tabs>
        </Fragment>
    );
};

export const config = render(
    <AdminPage>
        <App />
    </AdminPage>
);