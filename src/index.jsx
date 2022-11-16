import ForgeUI, { render, AdminPage, Fragment, Text, Button, useState, Strong, Form, Table, Head, Cell, Row,TextField, Select, Option, SectionMessage, ModalDialog, Tabs, Tab, Heading } from '@forge/ui';
import api, { storage, webTrigger, startsWith } from '@forge/api';
import { getSites, validateAtlasToken } from "./helper";
import { createObjectSchema, startAssetCreation } from './syncProcess';
const issues = [
    {
      key: 'XEN-1',
      status: 'In Progress',
    },
    {
      key: 'XEN-2',
      status: 'To Do',
    },
  ];
const App = () => {
    const [lsToken, setLsToken] = useState("");
    const [atlasToken, setAtlasToken] = useState("");
    const [atlasEmail, setAtlasEmail] = useState("");
    const [runAtInterval, setRunAtInterval] = useState(1);
    const [runAt, setRunAt] = useState("hourly");
    const [configStatus, setConfigStatus] = useState({});
    const [isOpen, setOpen] = useState(false);
    const [showRunSync, setShowRunSync] = useState(false);
    const [stats, setStats] = useState(async () => {
        const assets = await storage.query().where("key", startsWith("assetName")).limit(20).getMany()
        console.log("stats ==>", assets);
    });
    const [siteList, setSiteList] = useState(async() => {
        const config = await storage.getSecret("lsConfig");
        console.log("config ==>", config);
        if(config && config.lsToken){
            const allSites = await getSites(config.lsToken);
            if(allSites.length > 0){
                setAtlasToken(config.atlasToken);
                setAtlasEmail(config.atlasEmail);
                setLsToken(config.lsToken);
                setRunAt(config.runAt);
                setRunAtInterval(config.runAtInterval);
                setShowRunSync(true);
                return allSites;
            } else {
                return [];                
            }
        } else {
            return [];
        }
    });
    
    const validateAndSaveConfig = async (formData) => {
        const allSites = await getSites(formData.lsToken);
        if(allSites.length > 0){
            const workspaceId = await validateAtlasToken(formData.atlasEmail, formData.atlasToken);
            if(workspaceId){
                const finalConfig = {
                    "lsToken": formData.lsToken,
                    "atlasToken": formData.atlasToken,
                    "atlasEmail": formData.atlasEmail,
                    "selectedSites": [...allSites],
                    "workspaceId": workspaceId,
                    "runAt": formData.run,
                    "runAtInterval": formData.runInterval
                }
                storage.setSecret("lsConfig", finalConfig);
                setAtlasEmail(formData.atlasEmail);
                setAtlasToken(formData.atlasToken);
                setSiteList(allSites);
                setLsToken(formData.lsToken);
                setRunAt(formData.run);
                setRunAtInterval(formData.runInterval);
                setShowRunSync(true);
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
        } else {
            setConfigStatus({
                title: "Error",
                description: "Invalid Lansweeper API token. Please enter valid token.",
                appearance: "error"
            });
        }
    }

    const resetConfig = () => {
        storage.deleteSecret("lsConfig");
        setConfigStatus({})
        setSiteList([]);
        setAtlasToken("");
        setAtlasEmail("");
        setLsToken("")
        setRunAt("hourly");
        setRunAtInterval(1);
        setShowRunSync(false);
    };

    const actionButtons = [
        <Button text="Reset" onClick={() => setOpen(true)}/>
    ]

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
                        <Form onSubmit={validateAndSaveConfig} submitButtonText="Validate and Save" actionButtons={actionButtons}>
                            <TextField type='password' defaultValue={lsToken} isRequired name="lsToken" label="Lansweeper API Token" description="Enter Lansweeper personal application identity code"/>
                            <TextField type='email' defaultValue={atlasEmail} isRequired name="atlasEmail" label="Atlassian User Email ID" description="Enter Atlassian user email ID."/>
                            <TextField type='password' defaultValue={atlasToken} isRequired name="atlasToken" label="Atlassian API Token" description="Enter Atlassian API token required to call Jira Assets API."/>
                            <Select label="Run Scheduler" name="run" description='Select when the sync process will run' isRequired>
                                    <Option label="Hourly" value="hourly" defaultSelected={runAt === "hourly" ? true : false}/>
                                    <Option label="Daily" value="daily" defaultSelected={runAt === "daily" ? true : false}/>
                                    <Option label="Weekly" value="weekly" defaultSelected={runAt === "weekly" ? true : false}/>
                            </Select>
                            <TextField type='number' defaultValue={runAtInterval} isRequired name="runInterval" label="Set Run Interval" description="Set interval of after every X no. of hours, days or weeks the sync process will run."/>
                        </Form>
                        {Object.keys(configStatus).length > 0 && <SectionMessage title={configStatus.title} appearance={configStatus.appearance}>
                         <Text>{configStatus.description}</Text>
                         </SectionMessage>}
                        {showRunSync && <Button onClick={createObjectSchema} text="Run Full Sync" />}
                        
                </Tab>
                <Tab label="Statistics">
                <Heading size="small">Asset Types</Heading>
                <Table>
                    <Head>
                    <Cell>
                        <Text>Asset Type</Text>
                    </Cell>
                    <Cell>
                        <Text>No. of assets</Text>
                    </Cell>
                    </Head>
                    {issues.map(issue => (
                    <Row>
                        <Cell>
                        <Text>{issue.key}</Text>
                        </Cell>
                        <Cell>
                        <Text>{issue.status}</Text>
                        </Cell>
                    </Row>
                    ))}
                </Table>
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