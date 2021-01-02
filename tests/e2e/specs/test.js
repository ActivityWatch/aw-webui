/* eslint-disable jest/expect-expect */
// https://docs.cypress.io/api/introduction/api.html

describe('My First Test', () => {
  it('Visits the app root url', () => {
    cy.visit('/');
    cy.contains('h3', 'Hello early user');
  });
});
