import React from 'react';
import {useLocation} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {
  useVersions,
  useActiveDocContext,
  useDocsVersionCandidates,
  useDocsPreferredVersion,
} from '@docusaurus/plugin-content-docs/client';
import {translate} from '@docusaurus/Translate';
import {useHistorySelector} from '@docusaurus/theme-common';
import DefaultNavbarItem from '@theme/NavbarItem/DefaultNavbarItem';
import DropdownNavbarItem from '@theme/NavbarItem/DropdownNavbarItem';

function getVersionItems(versions, configs) {
  if (configs) {
    const versionMap = new Map(versions.map((version) => [version.name, version]));
    const toVersionItem = (name, config) => {
      const version = versionMap.get(name);
      if (!version) {
        throw new Error(`No docs version exist for name '${name}', please verify your 'docsVersionDropdown' navbar item versions config.
Available version names:\n- ${versions.map((v) => `${v.name}`).join('\n- ')}`);
      }
      return {version, label: config?.label ?? version.label};
    };
    if (Array.isArray(configs)) {
      return configs.map((name) => toVersionItem(name, undefined));
    }
    return Object.entries(configs).map(([name, config]) => toVersionItem(name, config));
  }
  return versions.map((version) => ({version, label: version.label}));
}

function useVersionItems({docsPluginId, configs}) {
  const versions = useVersions(docsPluginId);
  return getVersionItems(versions, configs);
}

function getVersionMainDoc(version) {
  return version.docs.find((doc) => doc.id === version.mainDocId);
}

function getVersionTargetDoc(version, activeDocContext) {
  return (
    activeDocContext.alternateDocVersions[version.name] ?? getVersionMainDoc(version)
  );
}

function useDisplayedVersionItem({docsPluginId, versionItems}) {
  const candidates = useDocsVersionCandidates(docsPluginId);
  const candidateItems = candidates
    .map((candidate) => versionItems.find((vi) => vi.version === candidate))
    .filter((vi) => vi !== undefined);
  return candidateItems[0] ?? versionItems[0];
}

function describeApiVersion(versionItem) {
  if (!versionItem) {
    return {segment: null, hasSegment: false};
  }
  if (versionItem.version?.isLast) {
    return {segment: '', hasSegment: false};
  }
  const label = versionItem.label?.toLowerCase();
  if (label === 'next' || versionItem.version?.name === 'current') {
    return {segment: 'next', hasSegment: true};
  }
  const name = versionItem.version?.name ?? '';
  return {segment: name, hasSegment: Boolean(name)};
}

function extractKnownVersionRemainder(relativePath, knownSegments) {
  if (!relativePath) {
    return {matched: false, remainder: ''};
  }
  const normalized = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  const trimmed = normalized.slice(1);
  for (const segment of knownSegments) {
    if (!segment) {
      continue;
    }
    if (trimmed === segment) {
      return {matched: true, remainder: ''};
    }
    if (trimmed.startsWith(`${segment}/`)) {
      return {matched: true, remainder: normalized.slice(segment.length + 1)};
    }
    if (trimmed.startsWith(`${segment}.html`)) {
      return {matched: true, remainder: normalized.slice(segment.length + 1)};
    }
  }
  return {matched: false, remainder: normalized};
}

function buildApiVersionTargetPath({
  pathname,
  apiBasePath,
  knownSegments,
  target,
}) {
  if (!pathname.startsWith(apiBasePath)) {
    return null;
  }
  const relative = pathname.slice(apiBasePath.length);
  const normalizedRelative =
    relative === '' || relative.startsWith('/') ? relative : `/${relative}`;
  const {matched, remainder} = extractKnownVersionRemainder(
    normalizedRelative,
    knownSegments,
  );
  if (target.hasSegment && target.segment) {
    const suffix = matched ? remainder : normalizedRelative;
    if (!suffix) {
      return `${apiBasePath}/${target.segment}`;
    }
    if (suffix.startsWith('/') || suffix.startsWith('.')) {
      return `${apiBasePath}/${target.segment}${suffix}`;
    }
    return `${apiBasePath}/${target.segment}/${suffix}`;
  }
  if (matched) {
    if (!remainder) {
      return apiBasePath;
    }
    if (remainder.startsWith('/') || remainder.startsWith('.')) {
      return `${apiBasePath}${remainder}`;
    }
    return `${apiBasePath}/${remainder}`;
  }
  return `${apiBasePath}${normalizedRelative}`;
}

export default function DocsVersionDropdownNavbarItem({
  mobile,
  docsPluginId,
  dropdownActiveClassDisabled,
  dropdownItemsBefore,
  dropdownItemsAfter,
  versions: configs,
  ...props
}) {
  const location = useLocation();
  const apiBasePath = useBaseUrl('/api').replace(/\/$/, '');
  const search = useHistorySelector((history) => history.location.search);
  const hash = useHistorySelector((history) => history.location.hash);
  const activeDocContext = useActiveDocContext(docsPluginId);
  const {savePreferredVersionName} = useDocsPreferredVersion(docsPluginId);
  const versionItems = useVersionItems({docsPluginId, configs});
  const apiVersionSegments = React.useMemo(
    () =>
      new Set(
        versionItems
          .map((item) => describeApiVersion(item))
          .filter((meta) => meta.hasSegment && meta.segment)
          .map((meta) => meta.segment),
      ),
    [versionItems],
  );
  const displayedVersionItem = useDisplayedVersionItem({
    docsPluginId,
    versionItems,
  });

  function versionItemToLink(versionItem) {
    const targetDoc = getVersionTargetDoc(versionItem.version, activeDocContext);
    const versionMeta = describeApiVersion(versionItem);
    const apiTargetPath = buildApiVersionTargetPath({
      pathname: location.pathname,
      apiBasePath,
      knownSegments: apiVersionSegments,
      target: versionMeta,
    });
    const targetPath = apiTargetPath ?? targetDoc.path;
    return {
      label: versionItem.label,
      to: `${targetPath}${search}${hash}`,
      isActive: () => versionItem.version === activeDocContext.activeVersion,
      onClick: () => savePreferredVersionName(versionItem.version.name),
    };
  }

  const items = [
    ...dropdownItemsBefore,
    ...versionItems.map(versionItemToLink),
    ...dropdownItemsAfter,
  ];

  const dropdownLabel =
    mobile && items.length > 1
      ? translate({
          id: 'theme.navbar.mobileVersionsDropdown.label',
          message: 'Versions',
          description: 'The label for the navbar versions dropdown on mobile view',
        })
      : displayedVersionItem.label;

  const dropdownTo =
    mobile && items.length > 1
      ? undefined
      : getVersionTargetDoc(displayedVersionItem.version, activeDocContext).path;

  if (items.length <= 1) {
    return (
      <DefaultNavbarItem
        {...props}
        mobile={mobile}
        label={dropdownLabel}
        to={dropdownTo}
        isActive={dropdownActiveClassDisabled ? () => false : undefined}
      />
    );
  }

  return (
    <DropdownNavbarItem
      {...props}
      mobile={mobile}
      label={dropdownLabel}
      to={dropdownTo}
      items={items}
      isActive={dropdownActiveClassDisabled ? () => false : undefined}
    />
  );
}
