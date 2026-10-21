// bootstrap-vue's $bvModal.msgBoxConfirm(), on top of bootstrap-vue-next's modal
// controller. Resolves true only when the user confirms.
export async function msgBoxConfirm(
  modalController: { confirm?: (param: { props: Record<string, unknown> }) => Promise<unknown> },
  body: string,
  props: Record<string, unknown> = {}
): Promise<boolean> {
  return (await modalController.confirm?.({ props: { ...props, body } })) === true;
}
