import { WorldMapData, ProgressReporter, ProvinceMap } from "../definitions";
import { CountriesLoader } from "./countries";
import { Loader, LoadResult, mergeInLoadResult } from "./common";
import { StatesLoader } from "./states";
import { DefaultMapLoader } from "./provincemap";
import { debug } from "../../../util/debug";
import { StrategicRegionsLoader } from "./strategicregion";
import { SupplyAreasLoader } from "./supplyarea";
import { LoaderSession } from "../../../util/loader/loader";
import { getConfiguration } from "../../../util/vsccommon";
import { RailwayLoader, SupplyNodeLoader } from "./railway";
import { ResourceDefinitionLoader } from "./resource";

export class WorldMapLoader extends Loader<WorldMapData> {
    private defaultMapLoader: DefaultMapLoader;
    private statesLoader: StatesLoader;
    private countriesLoader: CountriesLoader;
    private strategicRegionsLoader: StrategicRegionsLoader;
    private supplyAreasLoader: SupplyAreasLoader;
    private railwayLoader: RailwayLoader;
    private supplyNodeLoader: SupplyNodeLoader;
    private resourcesLoader: ResourceDefinitionLoader;
    private shouldReloadValue: boolean = false;

    constructor() {
        super();
        this.defaultMapLoader = new DefaultMapLoader();
        this.defaultMapLoader.onProgress(e => this.onProgressEmitter.fire(e));

        this.resourcesLoader = new ResourceDefinitionLoader();
        this.resourcesLoader.onProgress(e => this.onProgressEmitter.fire(e));

        this.statesLoader = new StatesLoader(this.defaultMapLoader, this.resourcesLoader);
        this.statesLoader.onProgress(e => this.onProgressEmitter.fire(e));

        this.countriesLoader = new CountriesLoader();
        this.countriesLoader.onProgress(e => this.onProgressEmitter.fire(e));

        this.strategicRegionsLoader = new StrategicRegionsLoader(this.defaultMapLoader, this.statesLoader);
        this.strategicRegionsLoader.onProgress(e => this.onProgressEmitter.fire(e));

        this.supplyAreasLoader = new SupplyAreasLoader(this.defaultMapLoader, this.statesLoader);
        this.supplyAreasLoader.onProgress(e => this.onProgressEmitter.fire(e));

        this.railwayLoader = new RailwayLoader(this.defaultMapLoader);
        this.railwayLoader.onProgress(e => this.onProgressEmitter.fire(e));

        this.supplyNodeLoader = new SupplyNodeLoader(this.defaultMapLoader);
        this.supplyNodeLoader.onProgress(e => this.onProgressEmitter.fire(e));
    }

    public async shouldReloadImpl(): Promise<boolean> {
        return this.shouldReloadValue;
    }

    public async loadImpl(session: LoaderSession): Promise<LoadResult<WorldMapData>> {
        this.shouldReloadValue = false;

        const provinceMap = await this.defaultMapLoader.load(session);
        session.throwIfCancelled();

        const stateMap = await this.statesLoader.load(session);
        session.throwIfCancelled();

        const countries = await this.countriesLoader.load(session);
        session.throwIfCancelled();

        const strategicRegions = await this.strategicRegionsLoader.load(session);
        session.throwIfCancelled();

        const enableSupplyArea = getConfiguration().enableSupplyArea;
        const supplyAreas = enableSupplyArea ?
            await this.supplyAreasLoader.load(session) :
            { warnings: [], result: { supplyAreas: [], badSupplyAreasCount: 0 }, dependencies: [] };
        session.throwIfCancelled();
        
        const railways = enableSupplyArea ?
            { warnings: [], result: { railways: [] }, dependencies: [] } :
            await this.railwayLoader.load(session);
        session.throwIfCancelled();
        
        const supplyNodes = enableSupplyArea ?
            { warnings: [], result: { supplyNodes: [] }, dependencies: [] } :
            await this.supplyNodeLoader.load(session);
        session.throwIfCancelled();

        const resources = await this.resourcesLoader.load(session);
        session.throwIfCancelled();

        const loadedLoaders = Array.from((session as any).loadedLoader).map<string>(v => (v as any).toString());
        debug('Loader session', loadedLoaders);

        const subLoaderResults = [ provinceMap, stateMap, countries, strategicRegions, supplyAreas, railways, supplyNodes, resources ];
        const warnings = mergeInLoadResult(subLoaderResults, 'warnings');

        const worldMap: WorldMapData = {
            ...provinceMap.result,
            ...stateMap.result,
            ...strategicRegions.result,
            ...supplyAreas.result,
            ...railways.result,
            ...supplyNodes.result,
            resources: resources.result,
            provincesCount: provinceMap.result.provinces.length,
            statesCount: stateMap.result.states.length,
            countriesCount: countries.result.length,
            strategicRegionsCount: strategicRegions.result.strategicRegions.length,
            supplyAreasCount: supplyAreas.result.supplyAreas.length,
            countries: countries.result,
            railwaysCount: railways.result.railways.length,
            supplyNodesCount: supplyNodes.result.supplyNodes.length,
            warnings,
        };

        delete (worldMap as unknown as Partial<ProvinceMap>)['colorByPosition'];

        const dependencies = mergeInLoadResult(subLoaderResults, 'dependencies');
        debug('World map dependencies', dependencies);

        return {
            result: worldMap,
            dependencies,
            warnings,
        };
    }

    public getWorldMap(force?: boolean): Promise<WorldMapData> {
        const session = new LoaderSession(force ?? false);
        return this.load(session).then(r => r.result);
    }

    public shallowForceReload(): void {
        this.shouldReloadValue = true;
    }
    
    protected extraMesurements(result: LoadResult<WorldMapData>) {
        return {
            ...super.extraMesurements(result),
            width: result.result.width,
            height: result.result.height,
            provincesCount: result.result.provincesCount,
            statesCount: result.result.statesCount,
            countriesCount: result.result.countriesCount,
            strategicRegionsCount: result.result.strategicRegionsCount,
            supplyAreasCount: result.result.supplyAreasCount,
        };
    }

    public toString() {
        return `[WorldMapLoader]`;
    }
}
