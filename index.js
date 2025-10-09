import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import fs from 'fs';

const token = process.env["GITHUB_TOKEN"];
const sonar_token = process.env['SONAR_TOKEN'];
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

export async function callAIAgent(promt) {
  console.log("Calling AI Agent with prompt:\n", promt);
  const client = ModelClient(
    endpoint,
    new AzureKeyCredential(token),
  );

  console.log("Client created, sending request to model:", model);
  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        { role:"system", content: "You are a helpful assistant." },
        { role:"user", content: promt }
      ],
      model: model
    }
  });

  console.log("Response received from model");
  if (isUnexpected(response)) {
    console.error("Error response from model:", response.body);
    throw response.body.error;
  }

  console.log(response.body.choices[0].message.content);
  return response.body.choices[0].message.content
}

const projectKey = 'pundliksarafdar_sonar-autofix-llm';

async function fetchSonarIssues() {
  const url = `https://sonarcloud.io/api/issues/search?componentKeys=${projectKey}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + btoa(sonar_token + ':')
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  
  const data = await response.json();
  //filter data for component
  const issues = data.issues.filter(issue => issue.flows && issue.flows.length > 0);
  return issues
}

async function fetchSonarHostpots() {
  const url = `https://sonarcloud.io/api/hotspots/search?projectKey=${projectKey}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + btoa(sonar_token + ':')
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  
  const data = await response.json();
  //const hotspots = data.hotspots.filter(hotspot => hotspot.component === 'pundliksarafdar_go-cache:my_cache.go');  
  return data.hotspots
}

function getFileContent(sourcePath, filePath) {
  try {
    const data = fs.readFileSync(sourcePath+filePath, 'utf8');
    const lines = data.split('\n');

    const numberedLines = lines.map((line, index) => `${index + 1}: ${line}`);

    const result = numberedLines.join('\n');
    //console.log(result);
    return result;
  } catch (err) {
    console.error('Error:', err);
  }
}

function writeFileContent(sourcePath, filePath, content) {
  try {
    const data = fs.writeFileSync(sourcePath+filePath, content, 'utf8');
    //console.log("File written successfully", data);
    return data;
  } catch (err) {
    console.error('Error:', err);
  }
}

async function startFixingIssues(issues) {
  console.log("Total issues found: ", issues.length);
  for (const issue of issues) {
    const filePath = issue.component.split(':')[1]; // Extract file path from component
    const fileContent = getFileContent("./",filePath);
    const prompt = buildPrompt(issue, fileContent, 'issue');
    console.log("Prompt to send to GPT-4.1:\n", prompt);
    console.log("Fixing issue: ", issue.message);
    const fixedContent = await callAIAgent(prompt).catch(console.error);
    console.log("Fixing issue completed. Writing to file: ", filePath);
    writeFileContent("./",filePath, fixedContent);
  }
}

async function startFixingHostspots(hotspots) {
  console.log("Total hotspots found: ", hotspots.length);
  for (const hotspot of hotspots) {
    const filePath = hotspot.component.split(':')[1]; // Extract file path from component
    const fileContent = getFileContent("./",filePath);
    const prompt = buildPrompt(hotspot, fileContent, 'hotspot');
    console.log("Prompt to send to GPT-4.1:\n", prompt);
    console.log("Fixing hotspot: ", hotspot.message);
    const fixedContent = await callAIAgent(prompt).catch(console.error);
    console.log("Fixing hotspot completed. Writing to file: ", filePath);
    writeFileContent("./",filePath, fixedContent);
  }
}


function buildPrompt(issue, fileContent, searchType) {
  const message = issue.message;
  let startLine, endLine;
  if(searchType === 'hotspot'){
    startLine = issue.textRange.startLine;
    endLine = issue.textRange.endLine;
  }else{
    const issueFlow = issue.flows[0]; // Assuming we take the first flow for simplicity
    startLine = issueFlow.locations[0].textRange.startLine;
    endLine = issueFlow.locations[0].textRange.endLine;
  }
  return `You are a code assistant. Here is a code snippet from a file:

  ${fileContent}

  The code has an issue: "${message}" located between lines ${startLine} and ${endLine}. Please provide fixed file for this issue only. 
    Do not change any other code. Do not include any explanation and do not add any annotation, Provide entire file with fix. 
    Add a comment near the fixed code lines indicating "AI Fix for issue: ${message}".`;
}

async function startAIAgent(){
  const issues = await fetchSonarIssues().catch(console.error);
  await startFixingIssues(issues);

  const  hotspots = await fetchSonarHostpots().catch(console.error);
  await startFixingHostspots(hotspots);
}


startAIAgent();