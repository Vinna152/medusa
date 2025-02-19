import { ModuleRegistrationName } from "@medusajs/modules-sdk"
import { IProductModuleService, ProductTypes } from "@medusajs/types"
import { getSelectsAndRelationsFromObjectArray } from "@medusajs/utils"
import { StepResponse, createStep } from "@medusajs/workflows-sdk"

type UpdateProductOptionsStepInput = {
  selector: ProductTypes.FilterableProductOptionProps
  update: ProductTypes.UpdateProductOptionDTO
}

export const updateProductOptionsStepId = "update-product-options"
export const updateProductOptionsStep = createStep(
  updateProductOptionsStepId,
  async (data: UpdateProductOptionsStepInput, { container }) => {
    const service = container.resolve<IProductModuleService>(
      ModuleRegistrationName.PRODUCT
    )

    const { selects, relations } = getSelectsAndRelationsFromObjectArray([
      data.update,
    ])

    const prevData = await service.listOptions(data.selector, {
      select: selects,
      relations,
    })

    // TODO: We need to update the module's signature
    // const productOptions = await service.updateOptions(data.selector, data.update)
    const productOptions = []
    return new StepResponse(productOptions, prevData)
  },
  async (prevData, { container }) => {
    if (!prevData?.length) {
      return
    }

    const service = container.resolve<IProductModuleService>(
      ModuleRegistrationName.PRODUCT
    )

    // TODO: We need to update the module's signature
    // await service.upsertOptions(
    //   prevData.map((r) => ({
    //     ...r,
    //   }))
    // )
  }
)
