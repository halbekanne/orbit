const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseRepoMapping } = require('./build-analysis');

describe('parseRepoMapping', () => {
  it('extracts project, repo and scriptPath from config.xml', () => {
    const xml = `<root>
      <sources><data><jenkins.branch.BranchSource>
        <source><traits>
          <jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
            <browser class="hudson.plugins.git.browser.BitbucketServer">
              <url>https://git.example.com/projects/DSYS/repos/design-system/</url>
            </browser>
          </jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
        </traits></source>
      </jenkins.branch.BranchSource></data></sources>
      <factory><scriptPath>Jenkinsfile</scriptPath></factory>
    </root>`;

    const result = parseRepoMapping(xml);
    assert.deepStrictEqual(result, {
      project: 'DSYS',
      repo: 'design-system',
      scriptPath: 'Jenkinsfile',
    });
  });

  it('defaults scriptPath to Jenkinsfile when missing', () => {
    const xml = `<root>
      <sources><data><jenkins.branch.BranchSource>
        <source><traits>
          <jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
            <browser class="hudson.plugins.git.browser.BitbucketServer">
              <url>https://git.example.com/projects/PROJ/repos/my-repo/</url>
            </browser>
          </jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
        </traits></source>
      </jenkins.branch.BranchSource></data></sources>
    </root>`;

    const result = parseRepoMapping(xml);
    assert.strictEqual(result.scriptPath, 'Jenkinsfile');
  });

  it('returns null when no BitbucketServer browser found', () => {
    const xml = `<root><sources><data></data></sources></root>`;
    assert.strictEqual(parseRepoMapping(xml), null);
  });
});
