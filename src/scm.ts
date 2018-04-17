
import * as path from 'path';
import * as fs from 'fs';
import { createClient as createManagementClient } from 'contentful-management';
import { Config, writeConfig } from './config';

interface ContentfulContentTypes {
    items: ContentfulContentType[];
}

interface ContentfulContentType {
    sys: Sys;
    fields: ContentfulContentTypeField[];
}

interface ContentfulContentTypeField {
    id: string;
}

interface ContentfulEntries {
    items: ContentfulEntry[];
}

interface ContentfulEntry {
    sys: Sys;
}

interface Sys {
    id: string;
    contentType?: ContentfulEntry;
}

class Entry {
    static fromContentfulEntry(contentfulEntry: ContentfulEntry, contentTypes: ContentfulContentTypes) {
        const contentType = contentTypes.items.find(ct => ct.sys.id === (<ContentfulEntry>contentfulEntry.sys.contentType).sys.id);
        if (!contentType)
            throw new Error(`Unknown content type ${(<ContentfulEntry>contentfulEntry.sys.contentType).sys.id}`);

        const entry = new Entry(contentfulEntry.sys.id, contentType);
        return entry;
    }

    constructor(public id: string, public contentType: ContentfulContentType) { }
}

export async function clone(spaceId: string, parentPath: string, accessToken: string): Promise<void> {
    const workingCopyPath = path.join(parentPath, spaceId);
    fs.mkdirSync(workingCopyPath);

    const hiddenDataPath = path.join(workingCopyPath, '.contentful-scm');
    fs.mkdirSync(hiddenDataPath);

    const config: Config = {
        spaceId,
        accessToken
    };
    await writeConfig(config, hiddenDataPath);

    const managementClient = getContentfulManagementClient(accessToken);
    const managementSpace = await managementClient.getSpace(spaceId);
    const masterEnvironment = await managementSpace.getEnvironment('master');

    // TODO: Get more than 100 entries
    const contentfulContentTypes: ContentfulContentTypes = await masterEnvironment.getContentTypes();
    // TODO: Get more than 100 entries
    const contentfulEntries: ContentfulEntries = await masterEnvironment.getEntries();

    writeHiddenCopy(contentfulContentTypes, contentfulEntries, hiddenDataPath);

    const entries = contentfulEntries.items.map((ce: any) => Entry.fromContentfulEntry(ce, contentfulContentTypes));
    writeWorkingCopy(entries, workingCopyPath);
}

function getContentfulManagementClient(accessToken: string) {
    return createManagementClient({
        accessToken
    });
}

function writeHiddenCopy(contentfulContentTypes: ContentfulContentTypes, entries: ContentfulEntries, hiddenDataPath: string) {
    const contentTypesPath = path.join(hiddenDataPath, 'content-types');
    fs.mkdirSync(contentTypesPath);

    for (const contentfulContentType of contentfulContentTypes.items) {
        const contentTypePath = path.join(contentTypesPath, `${contentfulContentType.sys.id}.json`);
        fs.writeFileSync(contentTypePath, JSON.stringify(contentfulContentType));
    }

    const entriesPath = path.join(hiddenDataPath, 'entries');
    fs.mkdirSync(entriesPath);

    for (const entry of entries.items) {
        const entryPath = path.join(entriesPath, `${entry.sys.id}.json`);
        fs.writeFileSync(entryPath, JSON.stringify(entry));
    }
}

function writeWorkingCopy(entries: Entry[], workingCopyPath: string) {
    for (const entry of entries) {
        const entryPath = path.join(workingCopyPath, `${entry.id}.json`);
        fs.writeFileSync(entryPath, JSON.stringify(entry, null, 2));
    }
}
