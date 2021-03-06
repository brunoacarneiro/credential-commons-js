const Ajv = require('ajv');

const uuidv1 = require('uuid/v1');
const UCA = require('../../src/uca/UserCollectableAttribute');
const VC = require('../../src/creds/VerifiableCredential');
const SchemaGenerator = require('../../src/schemas/generator/SchemaGenerator');
const credentialDefinitions = require('../../src/creds/definitions');
const ucaDefinitions = require('../../src/uca/definitions');

jest.setTimeout(1500000);

/**
 * Also check the integration tests, they add a new layer of testing on the published schemas
 */
describe('VerifiableCredentials SchemaGenerator validation', () => {
  it('Should validate the VC Schema generation against a single well known definition', () => {
    const name = new UCA.IdentityName({ givenNames: 'Joao', otherNames: 'Barbosa', familyNames: 'Santos' });
    const dob = new UCA.IdentityDateOfBirth({ day: 20, month: 1, year: 1978 });
    const cred = new VC('cvc:Credential:Identity', 'jest:test', null, [name, dob], 1);
    const jsonString = JSON.stringify(cred, null, 2);
    const generatedJson = JSON.parse(jsonString);
    const jsonSchema = SchemaGenerator.process(cred, generatedJson);
    expect(jsonSchema.properties.type.type).toBe('array');
    expect(jsonSchema.properties.version.type).toBe('string');
    expect(jsonSchema.properties.claim.type).toBe('object');
    expect(jsonSchema.properties.proof.type).toBe('object');
  });

  // Skiped while dmelosantos is working on this
  test.skip('Should validate the generated VC against it\'s generated schema looping the definitions', async (done) => {
    const validateSchemaJestStep = async (credentialDefinition) => {
      const ucaArray = [];
      credentialDefinition.depends.forEach((ucaDefinitionIdentifier) => {
        const ucaDefinition = ucaDefinitions.find(ucaDef => ucaDef.identifier === ucaDefinitionIdentifier);
        const ucaJson = SchemaGenerator.buildSampleJson(ucaDefinition);
        let value = ucaJson;
        if (Object.keys(ucaJson).length === 1) {
          value = Object.values(ucaJson)[0];
        }
        const dependentUca = new UCA(ucaDefinition.identifier, value, ucaDefinition.version);
        ucaArray.push(dependentUca);
      });
      const credential = new VC(credentialDefinition.identifier, `jest:test:${uuidv1()}`, null, ucaArray, 1);

      await credential.requestAnchor();
      await credential.updateAnchor();

      const jsonString = JSON.stringify(credential, null, 2);
      const generatedJson = JSON.parse(jsonString);
      const jsonSchema = SchemaGenerator.process(credential, generatedJson);
      const ajv = new Ajv();
      const validate = ajv.compile(jsonSchema);
      const isValid = validate(generatedJson);
      return isValid;
    };
    const promises = [];
    credentialDefinitions.forEach((credentialDefinition) => { promises.push(validateSchemaJestStep(credentialDefinition)); });
    Promise.all(promises).then((values) => {
      values.forEach(isValid => expect(isValid).toBeTruthy());
      done();
    });
  });

  it('Should change the VC Json data and fail against AJV', () => {
    const identifier = 'cvc:Credential:Identity';
    const credentialDefinition = credentialDefinitions.find(credsDef => credsDef.identifier === identifier);
    const ucaArray = [];
    credentialDefinition.depends.forEach((ucaDefinitionIdentifier) => {
      const ucaDefinition = ucaDefinitions.find(ucaDef => ucaDef.identifier === ucaDefinitionIdentifier);
      const ucaJson = SchemaGenerator.buildSampleJson(ucaDefinition);
      let value = ucaJson;
      if (Object.keys(ucaJson).length === 1) {
        value = Object.values(ucaJson)[0];
      }
      const dependentUca = new UCA(ucaDefinition.identifier, value, ucaDefinition.version);
      ucaArray.push(dependentUca);
    });
    const credential = new VC(credentialDefinition.identifier, `jest:test:${uuidv1()}`, null, ucaArray, 1);
    const jsonString = JSON.stringify(credential, null, 2);
    const generatedJson = JSON.parse(jsonString);
    const jsonSchema = SchemaGenerator.process(credential, generatedJson);
    generatedJson.claim.identity.name.familyNames = 123456;
    const ajv = new Ajv();
    const validate = ajv.compile(jsonSchema);
    const isValid = validate(generatedJson);
    expect(isValid).toBeFalsy();
  });

  it('Should add an property to the root of the json and fail against AJV additionalProperties', () => {
    const identifier = 'cvc:Credential:Identity';
    const credentialDefinition = credentialDefinitions.find(credsDef => credsDef.identifier === identifier);
    const ucaArray = [];
    credentialDefinition.depends.forEach((ucaDefinitionIdentifier) => {
      const ucaDefinition = ucaDefinitions.find(ucaDef => ucaDef.identifier === ucaDefinitionIdentifier);
      const ucaJson = SchemaGenerator.buildSampleJson(ucaDefinition);
      let value = ucaJson;
      if (Object.keys(ucaJson).length === 1) {
        value = Object.values(ucaJson)[0];
      }
      const dependentUca = new UCA(ucaDefinition.identifier, value, ucaDefinition.version);
      ucaArray.push(dependentUca);
    });
    const credential = new VC(credentialDefinition.identifier, `jest:test:${uuidv1()}`, null, ucaArray, 1);
    const jsonString = JSON.stringify(credential, null, 2);
    const generatedJson = JSON.parse(jsonString);
    const jsonSchema = SchemaGenerator.process(credential, generatedJson);
    generatedJson.anAdditionalPropertyToFail = 'test';
    const ajv = new Ajv();
    const validate = ajv.compile(jsonSchema);
    const isValid = validate(generatedJson);
    expect(isValid).toBeFalsy();
  });
});
