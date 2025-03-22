import { TechnologyTree, getTechnologyTrees } from "./schema";
import { HOIPartial } from "../../hoiformat/schema";
import { GuiFile } from "../../hoiformat/gui";
import { ContentLoader, Dependency, LoadResultOD, LoaderSession, mergeInLoadResult } from "../../util/loader/loader";
import { parseHoi4File } from "../../hoiformat/hoiparser";
import { localize } from "../../util/i18n";
import { flatMap, chain } from "lodash";
import { GuiFileLoader } from "../gui/loader";

export interface TechnologyTreeLoaderResult {
    technologyTrees: TechnologyTree[];
    guiFiles: { file: string, data: HOIPartial<GuiFile> }[];
    gfxFiles: string[];
}

const technologyUIGfxFiles = ['interface/countrytechtreeview.gfx', 'interface/countrytechnologyview.gfx'];
const technologiesGFX = 'interface/technologies.gfx';
const relatedGfxFiles = [...technologyUIGfxFiles, technologiesGFX];
const guiFilePath = ['interface/countrytechtreeview.gui', 'interface/countrydoctrinetreeview.gui'];

export class TechnologyTreeLoader extends ContentLoader<TechnologyTreeLoaderResult> {
    protected async postLoad(content: string | undefined, dependencies: Dependency[], error: any, session: LoaderSession): Promise<LoadResultOD<TechnologyTreeLoaderResult>> {
        if (error || (content === undefined)) {
            throw error;
        }

        const gfxDependencies = [...relatedGfxFiles, ...dependencies.filter(d => d.type === 'gfx').map(d => d.path)];
        const technologyTrees = getTechnologyTrees(parseHoi4File(content, localize('infile', 'In file {0}:\n', this.file)));
        const guiDependencies = [...guiFilePath, ...dependencies.filter(d => d.type === 'gui').map(d => d.path)];
        
        const guiDepFiles = await this.loaderDependencies.loadMultiple(guiDependencies, session, GuiFileLoader);

        return {
            result: {
                technologyTrees,
                gfxFiles: chain(gfxDependencies).concat(flatMap(guiDepFiles, r => r.result.gfxFiles)).uniq().value(),
                guiFiles: chain(guiDepFiles).flatMap(r => r.result.guiFiles).uniq().value(),
            },
            dependencies: chain([this.file]).concat(gfxDependencies, guiDependencies, mergeInLoadResult(guiDepFiles, 'dependencies')).uniq().value(),
        };
    }

    public toString() {
        return `[TechnologyTreeLoader ${this.file}]`;
    }
}
